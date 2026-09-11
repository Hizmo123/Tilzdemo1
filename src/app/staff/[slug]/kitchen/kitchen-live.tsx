"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Keeps the kitchen board live and audible.
//
//  - Reliable refresh: re-fetches on an interval whenever the tab is visible.
//    Unlike the general LiveRefresh, it does NOT pause after taps — a kitchen
//    touchscreen gets tapped constantly, and pausing there would delay new
//    tickets. (Polling is the transport for now; a Supabase Realtime broadcast
//    can replace the interval later without touching this component's callers.)
//  - Audible alert: compares the set of ticket ids across refreshes and chimes
//    when a new one appears (never on first load). The chime is generated with
//    the Web Audio API — no sound file, works offline.
//
// Browsers block audio until the user has interacted with the page, so the
// first tap anywhere unlocks it; after a PIN login + opening this screen that's
// already happened in practice.
export function KitchenLive({
  ticketIds,
  seconds = 4,
}: {
  ticketIds: string[];
  seconds?: number;
}) {
  const router = useRouter();
  const known = useRef<Set<string> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  // Unlock / prime the audio context on the first interaction.
  useEffect(() => {
    const prime = () => {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctor && !ctxRef.current) ctxRef.current = new Ctor();
        void ctxRef.current?.resume();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointerdown", prime, { once: true });
    prime();
    return () => window.removeEventListener("pointerdown", prime);
  }, []);

  function chime() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") void ctx.resume();
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
    if (hasNew) chime();
  }, [ticketIds]);

  // Reliable polling — visible tabs only, no interaction pause.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return null;
}
