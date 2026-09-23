"use client";

import { motion, useReducedMotion } from "motion/react";

const ITEMS: [string, string][] = [
  ["Flat white", "5.00"],
  ["Smashed avo", "18.00"],
  ["Bacon & egg roll", "12.00"],
  ["Cold brew", "6.00"],
  ["Banana bread", "6.00"],
];
const PEOPLE = ["Ari", "Sam", "Jo"];

// The "alive" part of the auth brand panel: a still, upright bill-split
// preview — the same card shape used on the homepage hero, but fully at
// rest here (no counting, no stagger, no tilt) so it reads as a finished
// product shot rather than something mid-animation. The only motion is a
// very slow drifting glow behind the card; the card itself never moves.
export function AuthPanelArt() {
  const reduced = useReducedMotion();
  return (
    <div className="relative" aria-hidden>
      {!reduced && (
        <>
          <motion.div
            className="absolute -top-24 -left-16 w-72 h-72 rounded-pill bg-pine/50 blur-3xl"
            animate={{ x: [0, 24, 0], y: [0, 18, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-20 right-0 w-64 h-64 rounded-pill bg-pine-soft/20 blur-3xl"
            animate={{ x: [0, -20, 0], y: [0, -14, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </>
      )}
      {reduced && (
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-pill bg-pine/50 blur-3xl" />
      )}

      <div className="relative rounded-[var(--radius-xl)] border border-line bg-surface shadow-float p-6">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <span className="font-display text-lg font-semibold tracking-tight">Harbour Kitchen</span>
          <span className="text-sm text-muted">Table 7</span>
        </div>

        <ul className="py-3 space-y-1.5">
          {ITEMS.map(([name, price]) => (
            <li key={name} className="flex justify-between text-sm">
              <span>{name}</span>
              <span className="tabular text-muted">${price}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between border-t border-line pt-3 font-medium">
          <span>Total</span>
          <span className="tabular">$47.00</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {PEOPLE.map((who) => (
            <div key={who} className="rounded-[var(--radius-md)] bg-success-soft text-success text-center py-2.5">
              <div className="text-xs flex items-center justify-center gap-1">
                {who}
                <svg viewBox="0 0 20 20" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 10.5l3.5 3.5L16 6" />
                </svg>
              </div>
              <div className="font-semibold tabular">$15.67</div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[var(--radius-md)] bg-ink text-surface text-center py-2.5 text-sm font-medium">
          Paid from the table
        </div>
      </div>
    </div>
  );
}
