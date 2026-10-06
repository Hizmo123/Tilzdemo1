"use client";

import type { PlanTier } from "@prisma/client";
import { motion } from "motion/react";
import { PLANS, planPriceLabel, PAY_AS_YOU_SELL_BLURB } from "@/lib/plans";
import { SPRING_PRESS, SPRING } from "@/components/ui/motion";
import { CHOICE_IDLE, CHOICE_SELECTED } from "./choice";

// The tier we lead with — same call as the marketing pricing section:
// Growth is where a venue going live across the whole floor lands.
const RECOMMENDED: PlanTier = "GROWTH";

// The 3 public tiers from PLANS as selectable cards, plus a "pay as you
// sell" strip for Connect beneath — Connect isn't offered as a fourth card
// here (it's grandfathered/hidden from every picker, same as Basic), but
// it must stay reachable from a fresh signup: selecting the strip calls
// onChange("CONNECT") through the exact same path a card click would, so
// the wizard's existing squareMandatory/choosePlan handling (lib/
// onboarding-options.ts#applyPlanChoice) picks it up identically — the
// Payments step still locks to Square, with no separate code path to drift.
export function PlanPicker({
  value,
  onChange,
}: {
  value: PlanTier;
  onChange: (tier: PlanTier) => void;
}) {
  return (
    <div className="space-y-3 pt-3">
      <div role="radiogroup" className="grid sm:grid-cols-3 gap-3">
        {PLANS.map((p) => {
          const selected = p.tier === value;
          const recommended = p.tier === RECOMMENDED;
          return (
            <motion.button
              key={p.tier}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(p.tier)}
              whileTap={{ scale: 0.98 }}
              transition={SPRING_PRESS}
              className={`relative text-left rounded-[var(--radius-card)] bg-surface border p-5 flex flex-col transition-[box-shadow,background-color,border-color] duration-[var(--dur-fast)] ${
                selected ? CHOICE_SELECTED : CHOICE_IDLE
              }`}
            >
              {recommended && (
                <span className="absolute -top-3 left-5 text-[11px] font-semibold uppercase tracking-wide bg-accent-gradient text-on-accent px-2.5 py-1 rounded-pill shadow-accent">
                  Most popular
                </span>
              )}

              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block font-display text-display-sm font-semibold">{p.name}</span>
                  <span className="block text-sm text-muted mt-0.5 min-h-[40px]">{p.blurb}</span>
                </span>
                <span
                  aria-hidden
                  className={`shrink-0 mt-1 w-5 h-5 rounded-pill border-2 flex items-center justify-center transition-colors duration-[var(--dur-fast)] ${
                    selected ? "border-pine bg-pine text-on-accent" : "border-line-strong"
                  }`}
                >
                  {selected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={SPRING}
                      className="w-2 h-2 rounded-pill bg-current"
                    />
                  )}
                </span>
              </span>

              <span className="block mt-4 font-display text-display-sm font-semibold">
                {planPriceLabel(p)}
                {p.cadence === "per month" && (
                  <span className="text-sm text-muted font-normal font-sans tracking-normal"> /month</span>
                )}
                {p.cadence === "free" && (
                  <span className="text-sm text-muted font-normal font-sans tracking-normal"> · no card needed</span>
                )}
              </span>

              <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <svg viewBox="0 0 20 20" className="w-4 h-4 mt-0.5 shrink-0 text-pine" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 10.5l3.5 3.5L16 6" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange("CONNECT")}
        className={`w-full text-left rounded-[var(--radius-card)] border p-4 flex items-center justify-between gap-4 transition-colors duration-[var(--dur-fast)] ${
          value === "CONNECT" ? CHOICE_SELECTED : CHOICE_IDLE
        }`}
      >
        <span>
          <span className="block text-sm font-semibold">Already use Square? Pay as you sell.</span>
          <span className="block text-xs text-muted mt-0.5">{PAY_AS_YOU_SELL_BLURB}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-pine-deep">
          Start free with Square
        </span>
      </button>
    </div>
  );
}
