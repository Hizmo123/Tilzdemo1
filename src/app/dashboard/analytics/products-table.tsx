"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";

type Row = {
  name: string;
  category: string | null;
  units: number;
  revenueCents: number;
  sharePct: number;
};

type SortKey = "revenue" | "units" | "name";

export function ProductsTable({
  rows,
  currency,
}: {
  rows: Row[];
  currency: string;
}) {
  const [sort, setSort] = useState<SortKey>("revenue");

  const sorted = [...rows].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "units") return b.units - a.units;
    return b.revenueCents - a.revenueCents;
  });

  const maxRev = Math.max(1, ...rows.map((r) => r.revenueCents));

  const th = "text-xs uppercase tracking-wide text-muted font-medium py-2";
  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => setSort(key)}
      className={`${th} hover:text-ink ${sort === key ? "text-ink" : ""}`}
    >
      {label}
      {sort === key ? " ↓" : ""}
    </button>
  );

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_120px] gap-4 px-5 border-b border-line items-center">
        <div className="text-left">{sortBtn("name", "Item")}</div>
        <div className="text-right">{sortBtn("units", "Units")}</div>
        <div className="text-right">{sortBtn("revenue", "Revenue")}</div>
        <div className={`${th} text-right`}>Share</div>
      </div>
      <ul className="divide-y divide-line">
        {sorted.map((r) => (
          <li
            key={r.name}
            className="grid grid-cols-[1fr_auto_auto_120px] gap-4 px-5 py-3 items-center"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.name}</p>
              {r.category && (
                <p className="text-xs text-muted">{r.category}</p>
              )}
            </div>
            <p className="text-sm tabular-nums text-right">{r.units}</p>
            <p className="text-sm tabular-nums text-right font-medium">
              {formatCents(r.revenueCents, currency)}
            </p>
            <div className="flex items-center gap-2 justify-end">
              <div className="w-14 h-1.5 rounded-full bg-paper overflow-hidden">
                <div
                  className="h-full bg-pine"
                  style={{ width: `${(r.revenueCents / maxRev) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted tabular-nums w-9 text-right">
                {r.sharePct.toFixed(0)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
