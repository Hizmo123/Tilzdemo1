"use client";

import { VENUE_TYPES } from "@/lib/onboarding-options";
import { Icon } from "./icons";

export function VenueTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {VENUE_TYPES.map((v) => {
        const active = value === v.value;
        return (
          <button
            key={v.value}
            type="button"
            onClick={() => onChange(v.value)}
            className={`flex flex-col items-center gap-2 rounded-[var(--radius-card)] border-2 px-3 py-4 text-center transition-colors ${
              active
                ? "border-pine bg-pine-soft text-pine-deep"
                : "border-line hover:border-ink/20"
            }`}
          >
            <Icon name={v.icon} className="w-6 h-6" />
            <span className="text-sm font-medium leading-tight">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
