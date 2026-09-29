"use client";

import { useId } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { DUR, EASE_OUT } from "@/components/ui/motion";

// One step of the stand configurator. Same motion recipe as
// components/ui/expandable-plan-card.tsx: the shell carries a `layout`
// animation so its height change is what animates, and the panel mounts at
// full size with only an opacity fade — nothing animates its own height, so
// there's never a double-move. Header and panel are `layout="position"` so
// their contents move without being scale-distorted by the shell's resize.
// Reduced motion: everything snaps.
const STEP_TRANSITION: Transition = { duration: DUR.slow, ease: EASE_OUT };
const INSTANT: Transition = { duration: 0 };

export type StepStatus = "active" | "complete" | "locked";

export function StepShell({
  number,
  title,
  status,
  summary,
  onChange,
  children,
}: {
  number: number;
  title: string;
  status: StepStatus;
  // The chosen value in plain words, shown on the collapsed row when complete.
  summary?: string;
  // Re-expands a completed step. Never resets anything after it.
  onChange: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const panelId = useId();

  const headerContent = (
    <>
      <StepMarker number={number} status={status} />
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${status === "locked" ? "text-muted" : "text-ink"}`}>{title}</span>
        {status === "complete" && summary && (
          <span className="block text-sm text-muted truncate mt-0.5">{summary}</span>
        )}
      </span>
      {status === "complete" && <span className="text-sm font-medium text-pine shrink-0">Change</span>}
    </>
  );

  return (
    <motion.section
      layout={!reduced}
      transition={reduced ? INSTANT : STEP_TRANSITION}
      aria-current={status === "active" ? "step" : undefined}
      className={`rounded-[var(--radius-card)] border border-line bg-surface overflow-hidden ${
        status === "active" ? "shadow-raised" : "shadow-rest"
      } ${status === "locked" ? "opacity-60" : ""}`}
    >
      {status === "complete" ? (
        <motion.button
          layout={reduced ? false : "position"}
          type="button"
          onClick={onChange}
          aria-expanded={false}
          aria-controls={panelId}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-2/50 transition-colors duration-[var(--dur-fast)]"
        >
          {headerContent}
        </motion.button>
      ) : (
        <motion.div
          layout={reduced ? false : "position"}
          aria-disabled={status === "locked" || undefined}
          className={`flex items-center gap-3 px-5 py-4 ${status === "active" ? "border-b border-line" : ""}`}
        >
          {headerContent}
        </motion.div>
      )}

      {status === "active" && (
        <motion.div
          id={panelId}
          layout={reduced ? false : "position"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: DUR.fast } : STEP_TRANSITION}
          className="px-5 py-5"
        >
          {children}
        </motion.div>
      )}
    </motion.section>
  );
}

function StepMarker({ number, status }: { number: number; status: StepStatus }) {
  const base = "w-7 h-7 rounded-pill shrink-0 flex items-center justify-center text-xs font-semibold tabular-nums";
  if (status === "complete") {
    return (
      <span className={`${base} bg-pine-soft text-pine-deep`} aria-label={`Step ${number} complete`}>
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return <span className={`${base} bg-pine text-white`}>{number}</span>;
  }
  return <span className={`${base} border border-line text-muted`}>{number}</span>;
}
