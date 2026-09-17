"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { advanceOrder } from "../kitchen/actions";

type ReadyOrder = {
  id: string;
  orderNumber: number | null;
  tableLabel: string;
};

const AUDIO_SESSION_KEY = "tillz.waiter.audioReady";

// Buzzes/chimes the waiter's device the moment the kitchen marks an order
// READY, and lets them mark it SERVED once it's delivered — closing the loop
// kitchen screen -> waiter without anyone needing to walk over and check.
// Sound follows the same "browser blocks audio until a real tap" pattern as
// the kitchen screen's chime (see KitchenLive) — vibration has no such block,
// so that fires regardless of whether sound is enabled yet.
export function ReadyBanner({ slug, orders }: { slug: string; orders: ReadyOrder[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const known = useRef<Set<string> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(
    () => typeof sessionStorage === "undefined" || sessionStorage.getItem(AUDIO_SESSION_KEY) !== "1",
  );

  function getOrCreateCtx(): AudioContext | null {
    if (ctxRef.current) return ctxRef.current;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
      return ctxRef.current;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const ctx = getOrCreateCtx();
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
    setAudioBlocked(!ctx || ctx.state !== "running");
  }, []);

  function enableSound() {
    const ctx = getOrCreateCtx();
    void ctx?.resume().then(() => {
      setAudioBlocked(ctx.state !== "running");
      if (ctx.state === "running") sessionStorage.setItem(AUDIO_SESSION_KEY, "1");
    });
  }

  function buzz() {
    const ctx = ctxRef.current;
    if (ctx && ctx.state === "running") {
      try {
        const t0 = ctx.currentTime;
        [660, 990].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          osc.connect(gain);
          gain.connect(ctx.destination);
          const start = t0 + i * 0.14;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
          osc.start(start);
          osc.stop(start + 0.22);
        });
      } catch {
        /* ignore */
      }
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([120, 60, 120]);
    }
  }

  useEffect(() => {
    const ids = orders.map((o) => o.id);
    if (known.current === null) {
      known.current = new Set(ids); // first render — no alert
      return;
    }
    const hasNew = ids.some((id) => !known.current!.has(id));
    known.current = new Set(ids);
    if (hasNew) buzz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  function markServed(orderId: string) {
    start(async () => {
      await advanceOrder(slug, orderId, "SERVED");
      router.refresh();
    });
  }

  if (orders.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-pine-deep">
          Ready for pickup ({orders.length})
        </h2>
        {audioBlocked && (
          <button
            onClick={enableSound}
            className="text-xs underline text-muted hover:text-ink"
          >
            Enable ready sound
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {orders.map((o) => (
          <div
            key={o.id}
            className="rounded-[var(--radius-card)] border border-pine/30 bg-pine-soft/40 p-3 flex items-center justify-between gap-3"
          >
            <p className="text-sm font-medium">
              Table {o.tableLabel}
              {o.orderNumber != null && (
                <span className="text-muted font-normal"> · #{o.orderNumber}</span>
              )}
            </p>
            <button
              disabled={pending}
              onClick={() => markServed(o.id)}
              className="shrink-0 text-xs rounded-md bg-pine text-white px-3 py-1.5 hover:bg-pine-deep disabled:opacity-50"
            >
              Mark served
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
