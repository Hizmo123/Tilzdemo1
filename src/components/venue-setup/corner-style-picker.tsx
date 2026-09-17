"use client";

import { CORNER_STYLES, type CornerKey } from "@/lib/theme";

const KEYS = Object.keys(CORNER_STYLES) as CornerKey[];

export function CornerStylePicker({
  value,
  onChange,
}: {
  value: CornerKey;
  onChange: (value: CornerKey) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => {
        const preset = CORNER_STYLES[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors ${
              active ? "border-pine bg-pine-soft" : "border-line hover:border-ink/20"
            }`}
          >
            <span
              className="w-10 h-10 border-2 border-ink/40 bg-paper"
              style={{ borderRadius: preset.radius }}
            />
            <span className="text-xs font-medium">{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
