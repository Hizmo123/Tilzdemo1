"use client";

import { CORNER_STYLES, type CornerKey } from "@/lib/theme";
import { OptionTile } from "./choice";

const KEYS = Object.keys(CORNER_STYLES) as CornerKey[];

export function CornerStylePicker({
  value,
  onChange,
}: {
  value: CornerKey;
  onChange: (value: CornerKey) => void;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => {
        const preset = CORNER_STYLES[key];
        return (
          <OptionTile key={key} selected={value === key} onClick={() => onChange(key)} label={preset.label}>
            <span
              className="w-10 h-10 border-2 border-current/40 bg-paper transition-[border-radius] duration-[var(--dur-base)]"
              style={{ borderRadius: preset.radius }}
            />
          </OptionTile>
        );
      })}
    </div>
  );
}
