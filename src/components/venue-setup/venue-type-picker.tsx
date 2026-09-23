"use client";

import { VENUE_TYPES } from "@/lib/onboarding-options";
import { Icon } from "./icons";
import { OptionTile } from "./choice";

export function VenueTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {VENUE_TYPES.map((v) => (
        <OptionTile key={v.value} selected={value === v.value} onClick={() => onChange(v.value)} label={v.label}>
          <Icon name={v.icon} className="w-6 h-6" />
        </OptionTile>
      ))}
    </div>
  );
}
