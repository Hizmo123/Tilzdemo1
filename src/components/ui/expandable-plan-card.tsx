"use client";

import { useId, useState } from "react";
import { LayoutGroup, motion, useReducedMotion, type Transition } from "motion/react";
import type { PlanTier } from "@prisma/client";
import { getFullPlanSpec } from "@/lib/plans";
import { DUR, EASE_OUT } from "./motion";

// One reusable "Full features" expand interaction, shared by the marketing
// pricing section (components/marketing/pricing-grid.tsx) and the dashboard
// Billing grid (app/dashboard/billing/checkout.tsx) — both render PLANS as
// a grid of cards, so the interaction lives here once rather than twice.
//
// Three pieces a caller composes around its OWN card chrome (border,
// elevation, price, feature list, CTA — none of that is touched):
//   - PlanCardGrid: the grid itself. CSS grid with equal-height rows
//     (auto-rows-fr) so every card is the same height regardless of how
//     long its feature list is, and a LayoutGroup so every card's reflow
//     is measured and animated in ONE coordinated pass.
//   - PlanCardShell: one grid cell. Carries the `layout` animation; when
//     expanded it spans two columns and every sibling slides aside to make
//     room (from sm up — a single column has nowhere to slide).
//   - PlanFeaturesReveal: the toggle + the derived spec panel, placed inside
//     the caller's own padded card content below its CTA.
//
// Exactly ONE transition (below) drives all of it — the shell's layout
// move, the panel's fade, the chevron — so nothing fights: the panel never
// animates its own height (that used to run concurrently with the shell's
// layout animation and produced a visible double-move); it mounts at full
// size with an opacity fade and the shell's layout animation carries the
// size change. Collapsing removes the panel outright and the shell shrinks
// under the same transition.

const PLAN_TRANSITION: Transition = { duration: DUR.slow, ease: EASE_OUT };
const INSTANT: Transition = { duration: 0 };

export function usePlanExpansion() {
  const [expandedTier, setExpandedTier] = useState<PlanTier | null>(null);
  function toggle(tier: PlanTier) {
    setExpandedTier((cur) => (cur === tier ? null : tier));
  }
  return { expandedTier, toggle };
}

export function PlanCardGrid({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <LayoutGroup>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 auto-rows-fr gap-4 ${className}`}>
        {children}
      </div>
    </LayoutGroup>
  );
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

  return (
    <motion.div
      layout={!reduced}
      transition={reduced ? INSTANT : PLAN_TRANSITION}
      className={`h-full min-w-0 ${isExpanded ? "sm:col-span-2" : ""} ${className}`}
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
        className="w-full h-10 rounded-[var(--radius-sm)] border border-line text-sm font-medium text-ink-soft hover:border-line-strong hover:text-ink flex items-center justify-center gap-1.5 transition-colors duration-[var(--dur-fast)]"
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
          transition={reduced ? INSTANT : PLAN_TRANSITION}
          aria-hidden
        >
          <path d="M5 7.5l5 5 5-5" />
        </motion.svg>
      </button>

      {expanded && (
        <motion.div
          id={panelId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: DUR.fast } : PLAN_TRANSITION}
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
    </div>
  );
}
