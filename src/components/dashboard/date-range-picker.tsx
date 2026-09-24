"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RANGE_PRESETS, RANGE_LABELS, type RangePreset } from "@/lib/date-range";

// URL-driven range picker: writes ?range=&from=&to= and lets the server
// component re-fetch with the new window. Shared by Analytics, the weekly
// report, Invoices and Order History so all filter identically.
export function DateRangePicker({
  value,
  customFrom,
  customTo,
  disabledPresets,
  minCustomDate,
}: {
  value: RangePreset;
  customFrom?: string;
  customTo?: string;
  // Optional, plan-gated greying-out (see lib/date-range.ts's
  // disabledPresets/earliestAllowedDateStr) — omitted by every existing
  // caller (Analytics/weekly-report/Invoices keep their current
  // clamp-after-the-fact behavior unchanged); Order History passes both so a
  // disallowed preset/date can't be picked in the first place.
  disabledPresets?: RangePreset[];
  minCustomDate?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function setPreset(preset: RangePreset) {
    go({ range: preset, from: preset === "custom" ? customFrom ?? null : null, to: preset === "custom" ? customTo ?? null : null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGE_PRESETS.filter((p) => p !== "custom").map((p) => {
        const disabled = disabledPresets?.includes(p) ?? false;
        return (
          <button
            key={p}
            type="button"
            disabled={disabled}
            title={disabled ? "Your plan limits history — upgrade for this range." : undefined}
            onClick={() => !disabled && setPreset(p)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              disabled
                ? "border-line text-muted/50 opacity-50 cursor-not-allowed"
                : value === p
                  ? "border-pine bg-pine-soft text-pine-deep"
                  : "border-line hover:border-ink/30"
            }`}
          >
            {RANGE_LABELS[p]}
          </button>
        );
      })}
      <div
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
          value === "custom" ? "border-pine bg-pine-soft" : "border-line"
        }`}
        title={minCustomDate ? "Your plan limits history — upgrade for a wider custom range." : undefined}
      >
        <input
          type="date"
          value={customFrom ?? ""}
          min={minCustomDate}
          onChange={(e) => go({ range: "custom", from: e.target.value })}
          className="text-sm bg-transparent focus:outline-none"
        />
        <span className="text-muted text-sm">–</span>
        <input
          type="date"
          value={customTo ?? ""}
          min={minCustomDate}
          onChange={(e) => go({ range: "custom", to: e.target.value })}
          className="text-sm bg-transparent focus:outline-none"
        />
      </div>
    </div>
  );
}
