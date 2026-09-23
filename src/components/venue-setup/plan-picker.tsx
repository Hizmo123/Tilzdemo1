"use client";

import type { PlanTier } from "@prisma/client";
import { motion } from "motion/react";
import { PLANS, planPriceLabel } from "@/lib/plans";
import { SPRING_PRESS, SPRING } from "@/components/ui/motion";

// The tier we lead with — same call as the marketing pricing section:
// Growth is where a venue going live across the whole floor lands.
const RECOMMENDED: PlanTier = "GROWTH";

// The four real tiers from PLANS as selectable cards. Visually the same
// treatment as the marketing pricing cards (raised + accent ring for the
// emphasised one, quiet surface for the rest), but with radio semantics —
// one is always selected.
export function PlanPicker({
  value,
  onChange,
}: {
  value: PlanTier;
  onChange: (tier: PlanTier) => void;
}) {
  return (
    <div role="radiogroup" className="grid sm:grid-cols-2 gap-3 pt-3">
      {PLANS.map((p) => {
        const selected = p.tier === value;
        const free = p.priceCents === 0;
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
            className={`relative text-left rounded-[var(--radius-card)] bg-surface p-5 flex flex-col transition-[box-shadow,background-color] duration-[var(--dur-fast)] ${
              selected
                ? "ring-2 ring-pine shadow-raised bg-pine-tint"
                : "border border-line shadow-rest hover:shadow-raised"
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
              {!free && <span className="text-sm text-muted font-normal font-sans tracking-normal"> /month</span>}
              {free && <span className="text-sm text-muted font-normal font-sans tracking-normal"> · no card needed</span>}
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
  );
}
