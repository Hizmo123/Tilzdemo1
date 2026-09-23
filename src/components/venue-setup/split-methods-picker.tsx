"use client";

import { SPLIT_METHODS, type SplitMethod } from "@/lib/onboarding-options";
import { ChoiceCard } from "./choice";

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
    <div role="group" className="space-y-2">
      {SPLIT_METHODS.map((m) => (
        <ChoiceCard
          key={m.value}
          indicator="check"
          selected={value.includes(m.value)}
          onClick={() => toggle(m.value)}
          title={m.label}
          desc={m.desc}
        />
      ))}
    </div>
  );
}
