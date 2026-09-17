"use client";

import { SERVICE_STYLES } from "@/lib/onboarding-options";
import { Icon } from "./icons";

export function ServiceStylePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {SERVICE_STYLES.map((s) => {
        const active = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={`w-full flex items-center gap-3.5 text-left rounded-[var(--radius-card)] border-2 p-3.5 transition-colors ${
              active ? "border-pine bg-pine-soft" : "border-line hover:border-ink/20"
            }`}
          >
            <span
              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                active ? "bg-pine text-[color:var(--on-accent,#fff)]" : "bg-paper text-muted"
              }`}
            >
              <Icon name={s.icon} className="w-4.5 h-4.5" />
            </span>
            <span>
              <span className="block text-sm font-medium">{s.label}</span>
              <span className="block text-xs text-muted mt-0.5">{s.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
