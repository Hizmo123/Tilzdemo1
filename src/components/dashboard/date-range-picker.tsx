"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RANGE_PRESETS, RANGE_LABELS, type RangePreset } from "@/lib/date-range";

// URL-driven range picker: writes ?range=&from=&to= and lets the server
// component re-fetch with the new window. Shared by Analytics, the weekly
// report and Invoices so all three filter identically.
export function DateRangePicker({
  value,
  customFrom,
  customTo,
}: {
  value: RangePreset;
  customFrom?: string;
  customTo?: string;
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
      {RANGE_PRESETS.filter((p) => p !== "custom").map((p) => (
        <button
          key={p}
          onClick={() => setPreset(p)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            value === p
              ? "border-pine bg-pine-soft text-pine-deep"
              : "border-line hover:border-ink/30"
          }`}
        >
          {RANGE_LABELS[p]}
        </button>
      ))}
      <div
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
          value === "custom" ? "border-pine bg-pine-soft" : "border-line"
        }`}
      >
        <input
          type="date"
          value={customFrom ?? ""}
          onChange={(e) => go({ range: "custom", from: e.target.value })}
          className="text-sm bg-transparent focus:outline-none"
        />
        <span className="text-muted text-sm">–</span>
        <input
          type="date"
          value={customTo ?? ""}
          onChange={(e) => go({ range: "custom", to: e.target.value })}
          className="text-sm bg-transparent focus:outline-none"
        />
      </div>
    </div>
  );
}
