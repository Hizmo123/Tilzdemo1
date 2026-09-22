"use client";

import { motion } from "motion/react";
import { SPRING_SOFT } from "@/components/ui/motion";

const STEPS = [
  { key: "SUBMITTED", label: "Received" },
  { key: "PREPARING", label: "Preparing" },
  { key: "READY", label: "Ready" },
] as const;

function stepIndex(status: string): number {
  if (status === "SUBMITTED") return 0;
  if (status === "PREPARING") return 1;
  if (status === "READY" || status === "SERVED") return 2;
  return -1;
}

// Received → Preparing → Ready. Fed by the page's live status (LiveRefresh
// re-renders it as the kitchen moves the ticket), so the fill bar and the
// current-step pulse animate forward on their own. Orders that aren't on
// the kitchen's board yet (awaiting approval / payment) get a plain badge.
export function OrderTracker({ status, compact = false }: { status: string; compact?: boolean }) {
  const idx = stepIndex(status);

  if (idx < 0) {
    const copy =
      status === "AWAITING_PAYMENT"
        ? { label: "Pay to send", cls: "bg-danger-soft text-danger" }
        : status === "CANCELLED"
          ? { label: "Cancelled", cls: "bg-surface-2 text-muted" }
          : { label: "Awaiting approval", cls: "bg-warn-soft text-warn" };
    return (
      <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${copy.cls}`}>
        {copy.label}
      </span>
    );
  }

  const done = status === "SERVED";
  const progress = done ? 1 : idx / (STEPS.length - 1);

  return (
    <div className={compact ? "w-full" : "w-full"} aria-label={`Order status: ${done ? "Served" : STEPS[idx].label}`}>
      <div className="relative flex items-center justify-between">
        {/* Track */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[3px] rounded-pill bg-surface-2" />
        <motion.div
          className="absolute left-3 top-1/2 -translate-y-1/2 h-[3px] rounded-pill bg-pine origin-left"
          style={{ right: 12 }}
          initial={false}
          animate={{ scaleX: progress }}
          transition={SPRING_SOFT}
        />
        {STEPS.map((s, i) => {
          const reached = i <= idx;
          const current = i === idx && !done;
          return (
            <div key={s.key} className="relative z-10 flex flex-col items-center gap-1.5 w-6">
              <span className="relative flex items-center justify-center w-6 h-6">
                {current && (
                  <span aria-hidden className="absolute inset-0 rounded-pill bg-pine/40 animate-pulse-ring" />
                )}
                <motion.span
                  initial={false}
                  animate={{ scale: reached ? 1 : 0.8, backgroundColor: reached ? "var(--color-pine)" : "var(--color-surface-2)" }}
                  transition={SPRING_SOFT}
                  className="relative w-6 h-6 rounded-pill flex items-center justify-center text-on-accent"
                >
                  {reached && (
                    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <motion.path
                        d="M5 10.5l3.2 3.2L15 7"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      />
                    </svg>
                  )}
                </motion.span>
              </span>
              {!compact && (
                <span className={`text-[11px] font-medium whitespace-nowrap ${reached ? "text-ink" : "text-muted"}`}>
                  {s.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {compact && (
        <p className="mt-1.5 text-[11px] font-medium text-muted">
          {done ? "Served" : STEPS[idx].label}
        </p>
      )}
    </div>
  );
}
