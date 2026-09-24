"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import { useWakeLock } from "@/lib/use-wake-lock";

const AUDIO_SESSION_KEY = "tillz.kitchen.audioReady";

// Keeps the kitchen board live, audible, and awake for a full shift.
//
//  - Instant refresh: a new order, approval or status change broadcasts
//    immediately (see @/lib/realtime) — a ticket appears the moment it's
//    placed, not on the next poll tick.
//  - Reliable polling as a fallback: re-fetches on an interval whenever the
//    tab is visible, in case a broadcast is missed. Does NOT pause after taps
//    — a kitchen touchscreen gets tapped constantly, and pausing there would
//    delay new tickets.
//  - Audible alert: compares the set of ticket ids across refreshes and
//    chimes when a new one appears (never on first load). Browsers block
//    audio until a real user gesture resumes it, and that block resets on
//    every full page load/reload — a sessionStorage flag alone can't bypass
//    it, so this always re-checks the AudioContext's actual state and only
//    hides the "enable sound" prompt once it's genuinely running.
//  - Screen wake lock: keeps a tablet on the pass from sleeping mid-service,
//    re-acquiring after the tab is backgrounded then comes back.
//  - Connection status: surfaced so a lost link to the server is obvious
//    instead of a silently-stale ticket list.
export function KitchenLive({
  ticketIds,
  restaurantId,
  seconds = 4,
  chimeEnabled = true,
}: {
  ticketIds: string[];
  restaurantId: string;
  seconds?: number;
  chimeEnabled?: boolean;
}) {
  const router = useRouter();
  const known = useRef<Set<string> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  // Seed optimistically from last session's outcome so a device that's
  // already been enabled today doesn't flash the gate while the real check
  // (below) runs — that check still always runs and corrects this if wrong.
  const [audioBlocked, setAudioBlocked] = useState(
    () => typeof sessionStorage === "undefined" || sessionStorage.getItem(AUDIO_SESSION_KEY) !== "1",
  );
  const [audioChecked, setAudioChecked] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());

  const { status } = useRealtimeRefresh(restaurantId, () => router.refresh());
  const { supported: wakeLockSupported, active: wakeLockActive } = useWakeLock(true);

  function getOrCreateCtx(): AudioContext | null {
    if (ctxRef.current) return ctxRef.current;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
      return ctxRef.current;
    } catch {
      return null;
    }
  }

  // On mount, and again whenever the tab regains focus (a suspended context
  // doesn't always resume itself), try to resume audio and check whether it
  // actually took — that check, not a stale flag, decides if the prompt shows.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const ctx = getOrCreateCtx();
      if (!ctx) {
        if (!cancelled) {
          setAudioBlocked(true);
          setAudioChecked(true);
        }
        return;
      }
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* still blocked — expected until a real tap */
        }
      }
      if (cancelled) return;
      setAudioBlocked(ctx.state !== "running");
      setAudioChecked(true);
      if (ctx.state === "running") {
        sessionStorage.setItem(AUDIO_SESSION_KEY, "1");
      }
    }
    check();
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enableSound() {
    const ctx = getOrCreateCtx();
    void ctx?.resume().then(() => {
      setAudioBlocked(ctx.state !== "running");
      if (ctx.state === "running") sessionStorage.setItem(AUDIO_SESSION_KEY, "1");
    });
  }

  function chime() {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    try {
      const t0 = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = t0 + i * 0.16;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        osc.start(start);
        osc.stop(start + 0.24);
      });
    } catch {
      /* ignore */
    }
  }

  // Chime when a genuinely new ticket id shows up.
  useEffect(() => {
    if (known.current === null) {
      known.current = new Set(ticketIds); // first render — no alert
      return;
    }
    const hasNew = ticketIds.some((id) => !known.current!.has(id));
    known.current = new Set(ticketIds);
    if (hasNew && chimeEnabled) chime();
  }, [ticketIds, chimeEnabled]);

  // Track when we last actually heard back from the server, so a stale
  // screen is visible rather than silent. Any successful render with fresh
  // server data (ticketIds recomputed) counts, whether or not it changed.
  useEffect(() => {
    setLastUpdatedAt(new Date());
  }, [ticketIds]);

  // Reliable polling — visible tabs only, no interaction pause.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return (
    <>
      <ConnectionBanner status={status} lastUpdatedAt={lastUpdatedAt} />
      {audioChecked && audioBlocked && chimeEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-6">
          <div className="w-full max-w-xs rounded-[var(--radius-card)] bg-surface p-6 text-center">
            <p className="text-2xl mb-2">🔔</p>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Enable kitchen sounds
            </h2>
            <p className="text-sm text-muted mt-1.5">
              Browsers block sound until you tap once. Do this now so new
              tickets chime all through service.
            </p>
            <button
              onClick={enableSound}
              className="mt-4 w-full rounded-[var(--radius-md)] bg-pine text-white py-3 font-medium hover:bg-pine-deep"
            >
              Enable sound
            </button>
          </div>
        </div>
      )}
      {audioChecked && !audioBlocked && !wakeLockSupported && (
        <WakeLockFallbackNotice />
      )}
    </>
  );
}

// Wake Lock isn't universally supported (older Safari/iOS in particular).
// Shown once per session rather than persistently, since it's a one-time
// device-setup instruction, not an ongoing problem.
function WakeLockFallbackNotice() {
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("tillz.kitchen.wakeLockNoticeSeen") === "1",
  );
  if (dismissed) return null;
  return (
    <div className="fixed top-2 inset-x-2 z-40 rounded-[var(--radius-sm)] bg-warn text-white text-sm px-4 py-2.5 flex items-center justify-between gap-3">
      <span>
        This device can&apos;t auto-keep the screen awake — turn off screen sleep
        in its display settings for this shift.
      </span>
      <button
        onClick={() => {
          sessionStorage.setItem("tillz.kitchen.wakeLockNoticeSeen", "1");
          setDismissed(true);
        }}
        className="shrink-0 underline"
      >
        Got it
      </button>
    </div>
  );
}

function ConnectionBanner({
  status,
  lastUpdatedAt,
}: {
  status: "connecting" | "connected" | "disconnected";
  lastUpdatedAt: Date;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsAgo = Math.max(0, Math.round((now - lastUpdatedAt.getTime()) / 1000));
  // Polling refreshes this every few seconds regardless of the realtime
  // channel's own state — a Supabase Realtime resubscribe (common on flaky
  // wifi, a phone switching networks, or just the provider's own connection
  // churn) used to flash a scary red "lost connection" banner the instant
  // `status` reported disconnected, even though polling never missed a beat
  // and the screen was never actually stale. What staff actually need to
  // know is whether the DATA is stale, not whether one particular transport
  // happens to be up this millisecond — so staleness (no successful refresh
  // in a while) is what triggers the banner, not the realtime status alone.
  const stale = secondsAgo > 20;
  const offline = stale && status === "disconnected";

  if (!stale) {
    // All good — a small, quiet corner indicator rather than nothing at all,
    // so "no news" still reads as "confirmed fine" not "untested".
    return (
      <div className="fixed bottom-2 right-2 z-40 text-[10px] text-muted bg-surface/80 backdrop-blur rounded-pill px-2.5 py-1 border border-line">
        Live · updated {secondsAgo <= 1 ? "just now" : `${secondsAgo}s ago`}
      </div>
    );
  }

  return (
    <div
      className={`fixed top-0 inset-x-0 z-40 text-center text-sm font-medium py-2 ${
        offline ? "bg-danger text-white" : "bg-warn text-white"
      }`}
    >
      {offline
        ? "⚠ Lost connection to the server — trying to reconnect…"
        : `⚠ No update in ${secondsAgo}s — checking connection…`}
    </div>
  );
}
