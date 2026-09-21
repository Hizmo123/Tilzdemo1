"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  runImport,
  setItemMapping,
  clearItemMapping,
  listSquareCatalogOptions,
  type SquareCatalogOption,
} from "./actions";
import type { ImportReport } from "@/lib/square/import";

type Row = {
  id: string;
  name: string;
  categoryName: string;
  status: "unmapped" | "mapped" | "auto_matched";
  squareItemId: string | null;
  squareVariationId: string | null;
};

const STATUS_LABEL: Record<Row["status"], string> = {
  mapped: "Mapped",
  auto_matched: "Auto-matched",
  unmapped: "Unmapped",
};

const STATUS_CLASS: Record<Row["status"], string> = {
  mapped: "bg-pine/10 text-pine-deep",
  auto_matched: "bg-amber-50 text-amber-800",
  unmapped: "bg-paper text-muted",
};

export function SquareMappingClient({
  initialRows,
  hasSynced,
}: {
  initialRows: Row[];
  hasSynced: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<SquareCatalogOption[] | null>(null);

  useEffect(() => {
    listSquareCatalogOptions().then(setOptions).catch(() => setOptions([]));
  }, []);

  function doImport() {
    setError(null);
    start(async () => {
      const res = await runImport();
      if (res.error) setError(res.error);
      if (res.report) setReport(res.report);
      router.refresh();
    });
  }

  function optionsFor() {
    return options ?? [];
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-medium">{hasSynced ? "Re-sync from Square" : "Import from Square"}</p>
            <p className="text-sm text-muted mt-0.5">
              Matches existing items by name, creates missing ones, and
              updates price/description/image for anything already mapped.
            </p>
          </div>
          <button
            onClick={doImport}
            disabled={pending}
            className="rounded-lg bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-60 shrink-0"
          >
            {pending ? "Importing…" : hasSynced ? "Re-sync from Square" : "Import from Square"}
          </button>
        </div>

        {error && <p className="text-sm text-danger mt-3">{error}</p>}

        {report && (
          <div className="mt-4 border-t border-line pt-4 text-sm space-y-1">
            <p>
              <span className="font-medium">{report.items.created}</span> created,{" "}
              <span className="font-medium">{report.items.matched}</span> matched,{" "}
              <span className="font-medium">{report.items.updated}</span> updated,{" "}
              <span className="font-medium">{report.items.skipped}</span> skipped
            </p>
            <p className="text-muted">
              Categories: {report.categories.created} created, {report.categories.matched} matched
              {" · "}
              Modifier groups: {report.modifierGroups.created} created, {report.modifierGroups.updated} updated
            </p>

            {report.items.results.some((r) => r.status === "skipped") && (
              <div className="mt-3">
                <p className="font-medium text-ink">Not imported</p>
                <ul className="mt-1 space-y-0.5">
                  {report.items.results
                    .filter((r) => r.status === "skipped")
                    .map((r) => (
                      <li key={r.squareItemId} className="text-muted">
                        {r.squareItemName} — {r.reason}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2.5 font-medium">Item</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Square mapping</th>
              <th className="px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {initialRows.map((row) => (
              <ItemRow key={row.id} row={row} options={optionsFor()} optionsLoading={options === null} />
            ))}
            {initialRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No menu items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemRow({
  row,
  options,
  optionsLoading,
}: {
  row: Row;
  options: SquareCatalogOption[];
  optionsLoading: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const currentKey = row.squareItemId && row.squareVariationId ? `${row.squareItemId}:${row.squareVariationId}` : "";

  function onChange(value: string) {
    if (!value) return;
    const [squareItemId, squareVariationId] = value.split(":");
    start(async () => {
      await setItemMapping(row.id, squareItemId, squareVariationId);
      router.refresh();
    });
  }

  function onClear() {
    start(async () => {
      await clearItemMapping(row.id);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2.5">{row.name}</td>
      <td className="px-4 py-2.5 text-muted">{row.categoryName}</td>
      <td className="px-4 py-2.5">
        <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${STATUS_CLASS[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <select
          value={currentKey}
          disabled={pending || optionsLoading}
          onChange={(e) => onChange(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-pine focus:outline-none"
        >
          <option value="">{optionsLoading ? "Loading…" : "— choose a Square item —"}</option>
          {options.map((o) => (
            <option key={`${o.squareItemId}:${o.squareVariationId}`} value={`${o.squareItemId}:${o.squareVariationId}`}>
              {o.squareItemName}
              {o.squareVariationName !== "Regular" ? ` (${o.squareVariationName})` : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2.5 text-right">
        {row.status !== "unmapped" && (
          <button
            onClick={onClear}
            disabled={pending}
            className="text-muted hover:text-danger"
          >
            Clear mapping
          </button>
        )}
      </td>
    </tr>
  );
}
