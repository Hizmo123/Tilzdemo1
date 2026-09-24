"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { PlanTier } from "@prisma/client";
import { getFullPlanSpec } from "@/lib/plans";
import { EASE_OUT, SPRING_SOFT } from "./motion";

// One reusable "Full features" expand/squeeze interaction, shared by the
// marketing pricing section (src/app/page.tsx) and the dashboard Billing
// grid (src/app/dashboard/billing/checkout.tsx) — both render PLANS as a
// row of cards, so the interaction lives here once rather than being
// implemented twice.
//
// Split into two pieces a caller composes around its OWN existing card
// markup (border, elevation, price, feature list, CTA — none of that is
// touched):
//   - PlanCardShell: the layout-animated flex item that grows the expanded
//     card and squeezes its siblings narrower. Wraps the WHOLE card
//     (border box included) so the squeeze reads as one continuous shape,
//     not a panel bolted on the side.
//   - PlanFeaturesReveal: the toggle button + the derived spec panel,
//     dropped inside the caller's own padded card content, below its
//     existing feature list / CTA — so the expanded detail stays inside
//     the same visual card, not floating outside it.
// usePlanExpansion holds the "which one tier is open" state; only one plan
// can be expanded across a whole grid at a time, and opening a second one
// closes whichever was open — both the closing card's un-squeeze and the
// newly opened card's growth are driven by the SAME state change, so
// motion's layout animation coordinates them in one pass rather than two
// separate transitions.

export function usePlanExpansion() {
  const [expandedTier, setExpandedTier] = useState<PlanTier | null>(null);
  function toggle(tier: PlanTier) {
    setExpandedTier((cur) => (cur === tier ? null : tier));
  }
  return { expandedTier, toggle };
}

export function PlanCardShell({
  tier,
  expandedTier,
  className = "",
  children,
}: {
  tier: PlanTier;
  expandedTier: PlanTier | null;
  className?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const isExpanded = expandedTier === tier;
  const anyExpanded = expandedTier !== null;

  // Default: the original even grid (1/2/3/5 columns), accounting for the
  // gap-4 gutter so N columns actually sum to 100%. Expanded: this card
  // takes most of the row; every sibling — regardless of which breakpoint's
  // column count they'd normally hold — shrinks to a narrow strip so the
  // "squeeze away to make room" reads the same at every width down to the
  // point they wrap to their own row below (a smooth reflow, not a jump,
  // since every card here carries `layout`).
  const basis = isExpanded
    ? "basis-full sm:basis-[58%]"
    : anyExpanded
      ? "basis-full sm:basis-[14%]"
      : "basis-full sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2rem)/3)] 2xl:basis-[calc((100%-4rem)/5)]";

  return (
    <motion.div
      layout={!reduced}
      transition={reduced ? { duration: 0 } : SPRING_SOFT}
      className={`shrink-0 grow-0 ${basis} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function PlanFeaturesReveal({
  tier,
  expanded,
  onToggle,
}: {
  tier: PlanTier;
  expanded: boolean;
  onToggle: () => void;
}) {
  const reduced = useReducedMotion();
  const panelId = useId();
  const lines = getFullPlanSpec(tier);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full h-10 rounded-lg border border-line text-sm font-medium text-ink-soft hover:border-ink/30 hover:text-ink flex items-center justify-center gap-1.5 transition-colors"
      >
        {expanded ? "Hide full features" : "Full features"}
        <motion.svg
          viewBox="0 0 20 20"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={reduced ? { duration: 0 } : SPRING_SOFT}
          aria-hidden
        >
          <path d="M5 7.5l5 5 5-5" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0.12 } : { duration: 0.32, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <dl className="mt-4 pt-4 border-t border-line space-y-3 text-sm">
              {lines.map((line) => (
                <div key={line.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted">{line.label}</dt>
                  <dd className="text-ink-soft leading-snug mt-0.5">{line.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
