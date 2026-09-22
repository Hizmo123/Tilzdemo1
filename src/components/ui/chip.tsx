"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { SPRING_PRESS, SPRING_SOFT } from "./motion";

// Selectable pill. Selected = the venue accent (customer pages) / Tillz pine
// (dashboard); unselected sits quietly on the surface. 44px tall so it's a
// real tap target even though it looks small.
export function Chip({
  selected = false,
  onClick,
  children,
  className = "",
  tone = "accent",
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  tone?: "accent" | "ink";
}) {
  const on = tone === "ink" ? "bg-ink text-surface" : "bg-pine text-on-accent shadow-accent";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      transition={SPRING_PRESS}
      aria-pressed={selected}
      onClick={onClick}
      className={`shrink-0 h-10 px-4 rounded-pill text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-[var(--dur-fast)] ${
        selected ? on : "bg-surface text-ink-soft border border-line hover:border-line-strong"
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

// Segmented control with a sliding indicator (Full / Equally / Items). The
// indicator is a layout-animated pill that glides between options.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      className={`relative grid gap-1 rounded-pill bg-surface-2 p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 h-10 rounded-pill text-sm font-medium transition-colors duration-[var(--dur-fast)] ${
              active ? "text-ink" : "text-muted hover:text-ink-soft"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING_SOFT}
                className="absolute inset-0 -z-10 rounded-pill bg-surface shadow-raised"
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
