"use client";

import { motion } from "motion/react";
import { SPRING, SPRING_PRESS } from "@/components/ui/motion";

// The selectable surfaces every setup picker is built from (onboarding
// wizard AND Settings → Venue setup / Appearance, which share the pickers).
// One selection language: a resting card that lifts on hover, presses on
// tap, and — when chosen — takes the accent ring, a faint accent tint and
// the raised shadow. Same chrome as the plan / payment / layout cards, so a
// choice looks like a choice on every step.

export const CHOICE_SELECTED = "border-pine ring-1 ring-pine bg-pine-tint shadow-raised";
export const CHOICE_IDLE = "border-line shadow-rest hover:shadow-raised hover:border-line-strong";

// Wide row: title + description, optional leading icon, radio or checkbox
// indicator on the right. Used for presets, yes/no pairs, multi-select lists.
export function ChoiceCard({
  selected,
  onClick,
  title,
  desc,
  icon,
  indicator = "radio",
  footnote,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc?: string;
  icon?: React.ReactNode;
  indicator?: "radio" | "check" | "none";
  footnote?: string;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      role={indicator === "check" ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_PRESS}
      className={`w-full text-left rounded-[var(--radius-card)] bg-surface border p-3.5 transition-[box-shadow,background-color,border-color] duration-[var(--dur-fast)] ${
        selected ? CHOICE_SELECTED : CHOICE_IDLE
      } ${className}`}
    >
      <span className="flex items-start gap-3">
        {icon && (
          <span
            className={`shrink-0 w-9 h-9 rounded-pill flex items-center justify-center transition-colors duration-[var(--dur-fast)] ${
              selected ? "bg-pine text-on-accent" : "bg-surface-2 text-ink-soft"
            }`}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          {desc && <span className="block text-xs text-muted mt-0.5 leading-relaxed">{desc}</span>}
          {footnote && <span className="block text-[11px] text-muted mt-1.5">{footnote}</span>}
        </span>
        {indicator !== "none" && <Indicator kind={indicator} selected={selected} />}
      </span>
    </motion.button>
  );
}

// Compact grid tile: a preview/icon above a short label. Venue types,
// corner styles, themes, fonts.
export function OptionTile({
  selected,
  onClick,
  label,
  children,
  className = "",
  ariaLabel,
}: {
  selected: boolean;
  onClick: () => void;
  label?: string;
  children?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_PRESS}
      className={`flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] bg-surface border px-3 py-3.5 text-center min-w-0 transition-[box-shadow,background-color,border-color] duration-[var(--dur-fast)] ${
        selected ? `${CHOICE_SELECTED} text-pine-deep` : `${CHOICE_IDLE} text-ink-soft`
      } ${className}`}
    >
      {children}
      {label && <span className="text-xs font-medium leading-tight truncate max-w-full">{label}</span>}
    </motion.button>
  );
}

// Short two-or-three-up option (On / Off, After / Before). 44px tall.
export function PillOption({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_PRESS}
      className={`h-11 rounded-[var(--radius-md)] bg-surface border px-3 text-sm font-medium transition-[box-shadow,background-color,border-color,color] duration-[var(--dur-fast)] ${
        selected ? `${CHOICE_SELECTED} text-pine-deep` : `${CHOICE_IDLE} text-ink-soft`
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function Indicator({ kind, selected }: { kind: "radio" | "check"; selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center border-2 transition-colors duration-[var(--dur-fast)] ${
        kind === "radio" ? "rounded-pill" : "rounded-[6px]"
      } ${selected ? "border-pine bg-pine text-on-accent" : "border-line-strong"}`}
    >
      {selected &&
        (kind === "radio" ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING} className="w-2 h-2 rounded-pill bg-current" />
        ) : (
          <svg viewBox="0 0 20 20" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M4 10.5l3.5 3.5L16 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
          </svg>
        ))}
    </span>
  );
}
