"use client";

import { Button } from "@/components/ui/button";
import type { TableRow } from "./types";

export function TablesStep({
  tables,
  checked,
  onToggle,
  onSelectAllWithoutStand,
  onContinue,
}: {
  tables: TableRow[];
  checked: Set<string>;
  onToggle: (id: string) => void;
  onSelectAllWithoutStand: () => void;
  onContinue: () => void;
}) {
  const withoutStand = tables.filter((t) => !t.hasStand).length;
  const allWithoutStandChecked = tables.every((t) => t.hasStand || checked.has(t.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">
          One stand per table you tick. Tables that already have a stand can still be ticked to
          order a spare.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-medium tabular-nums">
          {checked.size} of {tables.length} selected
        </span>
        {withoutStand > 0 && (
          <button
            type="button"
            onClick={onSelectAllWithoutStand}
            disabled={allWithoutStandChecked}
            className="text-sm font-medium text-pine hover:underline disabled:text-muted disabled:no-underline"
          >
            Select all tables without a stand ({withoutStand})
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {tables.map((t) => {
          const on = checked.has(t.id);
          return (
            <label
              key={t.id}
              className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 h-11 text-sm cursor-pointer transition-colors duration-[var(--dur-fast)] ${
                on ? "border-pine bg-pine-tint" : "border-line hover:border-line-strong"
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => onToggle(t.id)} className="accent-pine" />
              <span className="truncate">
                {t.label}
                {t.section ? <span className="text-muted"> · {t.section}</span> : null}
              </span>
              {t.hasStand && (
                <span className="ml-auto text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-pine-soft text-pine-deep shrink-0">
                  Has stand
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="max-w-xs">
        <Button type="button" variant="secondary" full onClick={onContinue} disabled={checked.size === 0}>
          Continue to shipping
        </Button>
      </div>
    </div>
  );
}
