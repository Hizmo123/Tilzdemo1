"use client";

import { SPLIT_METHODS, type SplitMethod } from "@/lib/onboarding-options";

export function SplitMethodsPicker({
  value,
  onChange,
}: {
  value: SplitMethod[];
  onChange: (value: SplitMethod[]) => void;
}) {
  function toggle(m: SplitMethod) {
    if (value.includes(m)) {
      // Keep at least one method selected — an empty set would leave guests
      // with no way to pay at all.
      if (value.length === 1) return;
      onChange(value.filter((v) => v !== m));
    } else {
      onChange([...value, m]);
    }
  }

  return (
    <div className="space-y-2">
      {SPLIT_METHODS.map((m) => {
        const active = value.includes(m.value);
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => toggle(m.value)}
            className={`w-full flex items-center gap-3 text-left rounded-[var(--radius-card)] border-2 p-3.5 transition-colors ${
              active ? "border-pine bg-pine-soft" : "border-line hover:border-ink/20"
            }`}
          >
            <span
              className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
                active ? "border-pine bg-pine" : "border-line"
              }`}
            >
              {active && (
                <svg viewBox="0 0 16 16" className="w-3 h-3 text-white" fill="currentColor">
                  <path d="M6.5 11.5 3 8l1-1 2.5 2.5L12 4l1 1-6.5 6.5Z" />
                </svg>
              )}
            </span>
            <span>
              <span className="block text-sm font-medium">{m.label}</span>
              <span className="block text-xs text-muted mt-0.5">{m.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
