"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { callStaff } from "./request-actions";
import { Button } from "@/components/ui/button";
import { SPRING, SPRING_PRESS, easeOut, haptic } from "@/components/ui/motion";

function BellIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

// One-tap staff call. Sends a generic "needs assistance" flag and confirms —
// no menu of reasons.
export function CallStaff({
  token,
  variant = "button",
}: {
  token: string;
  // "fab" is a small floating affordance for screens with their own primary
  // content (e.g. the menu, which already has a cart bar at the bottom) —
  // same action, just out of the way rather than a full-width row. "pill"
  // is the same compact control placed inline (the menu header) rather than
  // fixed, so it never overlaps the sticky category chips.
  // "tile" is the table-landing card: same chrome as the Bill & pay tile
  // beside it (icon, elevation, press), with an in-place confirmation state.
  variant?: "button" | "block" | "fab" | "pill" | "tile";
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  function call() {
    haptic();
    start(async () => {
      await callStaff(token);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    });
  }

  if (variant === "fab" || variant === "pill") {
    return (
      <motion.button
        type="button"
        onClick={call}
        disabled={pending || sent}
        whileTap={{ scale: 0.94 }}
        transition={SPRING_PRESS}
        className={`h-11 rounded-pill px-3.5 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-80 ${
          variant === "fab" ? "fixed top-3 right-4 z-30 glass shadow-raised" : "bg-surface border border-line shadow-rest"
        }`}
      >
        <BellIcon className="w-4 h-4" />
        {sent ? "Notified" : pending ? "Notifying…" : "Call staff"}
      </motion.button>
    );
  }

  if (variant === "tile") {
    return (
      <motion.button
        type="button"
        onClick={call}
        disabled={pending || sent}
        whileTap={{ scale: 0.97 }}
        transition={SPRING_PRESS}
        aria-live="polite"
        className={`w-full min-h-[92px] rounded-[var(--radius-lg)] p-4 text-left flex flex-col justify-between transition-[background-color,box-shadow,border-color] duration-[var(--dur-base)] ${
          sent
            ? "bg-pine-soft border border-pine/30 shadow-rest"
            : "bg-surface border border-line shadow-rest hover:shadow-raised"
        }`}
      >
        <span
          className={`relative inline-flex w-8 h-8 items-center justify-center rounded-pill transition-colors duration-[var(--dur-base)] ${
            sent ? "bg-pine text-on-accent" : "bg-surface-2 text-ink-soft"
          }`}
        >
          {sent && <span aria-hidden className="absolute inset-0 rounded-pill bg-pine/40 animate-pulse-ring" />}
          {sent ? (
            <svg viewBox="0 0 20 20" className="relative w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M4 10.5l3.5 3.5L16 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
            </svg>
          ) : (
            <BellIcon className={`relative w-4 h-4 ${pending ? "animate-pulse" : ""}`} />
          )}
        </span>
        <span>
          <span className="block font-display text-base font-semibold leading-tight">
            {sent ? "On our way" : pending ? "Notifying…" : "Call staff"}
          </span>
          <span className={`block text-xs mt-0.5 ${sent ? "text-pine-deep" : "text-muted"}`}>
            {sent ? "Staff have been notified" : "We'll come to your table"}
          </span>
        </span>
      </motion.button>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: easeOut(0.15) }}
          transition={SPRING}
          className="w-full min-h-[52px] rounded-[var(--radius-lg)] bg-pine-soft text-pine-deep px-4 py-3 font-medium flex items-center justify-center gap-2 text-sm"
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M4 10.5l3.5 3.5L16 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
          </svg>
          Staff notified — someone&apos;s on the way
        </motion.div>
      ) : (
        <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Button variant="secondary" size="lg" full onClick={call} loading={pending} className="gap-2.5">
            {!pending && <BellIcon />}
            {pending ? "Notifying…" : "Call staff"}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
