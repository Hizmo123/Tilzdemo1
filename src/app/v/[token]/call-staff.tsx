"use client";

import { useState, useTransition } from "react";
import { callStaff } from "./request-actions";

// One-tap staff call. Sends a generic "needs assistance" flag and confirms —
// no menu of reasons.
export function CallStaff({
  token,
  variant = "button",
}: {
  token: string;
  // "fab" is a small floating affordance for screens with their own primary
  // content (e.g. the menu, which already has a sticky cart bar at the
  // bottom) — same action, just out of the way rather than a full-width row.
  variant?: "button" | "block" | "fab";
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  function call() {
    start(async () => {
      await callStaff(token);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    });
  }

  if (variant === "fab") {
    return (
      <button
        onClick={call}
        disabled={pending || sent}
        className="fixed top-4 right-4 z-10 rounded-full border border-line bg-surface/95 backdrop-blur px-3.5 py-2 text-xs font-medium shadow-sm hover:border-ink/30 disabled:opacity-70 transition-colors"
      >
        {sent ? "✓ Notified" : pending ? "Notifying…" : "Call staff"}
      </button>
    );
  }

  if (sent) {
    return (
      <div className="w-full rounded-xl bg-pine-soft text-pine-deep py-3.5 font-medium text-center">
        ✓ Staff have been notified — someone&apos;s on the way
      </div>
    );
  }

  return (
    <button
      onClick={call}
      disabled={pending}
      className={
        variant === "block"
          ? "w-full rounded-xl border border-line bg-surface py-3.5 font-medium hover:border-ink/30 disabled:opacity-60 transition-colors"
          : "w-full rounded-xl border border-line bg-surface py-3 font-medium hover:border-ink/30 disabled:opacity-60 transition-colors"
      }
    >
      {pending ? "Notifying…" : "Call staff"}
    </button>
  );
}
