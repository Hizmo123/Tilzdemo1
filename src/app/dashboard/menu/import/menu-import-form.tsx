"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import {
  previewMenuImportAction,
  commitMenuImportAction,
  type PreviewState,
  type CommitState,
} from "./actions";

export function MenuImportForm({ currency }: { currency: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [result, setResult] = useState<CommitState | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setFileName(null);
    setCsvText(null);
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvText(text);
      start(async () => {
        const res = await previewMenuImportAction(text);
        setPreview(res);
      });
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!csvText) return;
    start(async () => {
      const res = await commitMenuImportAction(csvText);
      setResult(res);
      if ("ok" in res) {
        setPreview(null);
        router.refresh();
      }
    });
  }

  const blocked = preview && "ok" in preview && preview.errors.length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          1. Get the template
        </h2>
        <p className="text-sm text-muted mb-3">
          One row per item. Add as many categories and items as you like —
          re-uploading a file you've already imported is safe, it won't create
          duplicates.
        </p>
        <a
          href="/dashboard/menu/import/template"
          className="inline-block text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
        >
          Download CSV template
        </a>
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          2. Upload your file
        </h2>
        <p className="text-sm text-muted mb-3">
          Nothing is created until you confirm on the next step.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="text-sm"
        />
        {fileName && <p className="text-xs text-muted mt-2">{fileName}</p>}
      </div>

      {pending && !preview && <p className="text-sm text-muted">Checking your file…</p>}

      {preview && "error" in preview && (
        <p className="rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
          {preview.error}
        </p>
      )}

      {preview && "ok" in preview && (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            3. Review before importing
          </h2>

          {preview.errors.length > 0 && (
            <div className="rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm space-y-1">
              <p className="font-medium">
                {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} need fixing
                before you can import:
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                {preview.errors.slice(0, 15).map((e, i) => (
                  <li key={i}>
                    Row {e.rowNumber}: {e.message}
                  </li>
                ))}
              </ul>
              {preview.errors.length > 15 && (
                <p>…and {preview.errors.length - 15} more.</p>
              )}
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 text-amber-800 px-3.5 py-2.5 text-sm space-y-1">
              <p className="font-medium">
                {preview.warnings.length} note{preview.warnings.length === 1 ? "" : "s"} —
                these won't stop the import:
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                {preview.warnings.slice(0, 10).map((w, i) => (
                  <li key={i}>
                    Row {w.rowNumber}: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {preview.categories.map((cat) => (
              <div key={cat.name}>
                <p className="text-sm font-medium mb-1.5">
                  {cat.name}{" "}
                  <span className="text-xs font-normal text-muted">
                    {cat.isNew ? "· new category" : "· existing category"}
                  </span>
                </p>
                <ul className="space-y-1">
                  {cat.items.map((it) => (
                    <li
                      key={it.rowNumber}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0">
                        {it.name}
                        {it.modifierGroupName && (
                          <span className="text-xs text-muted">
                            {" "}
                            · {it.modifierGroupName} ({it.optionCount} option
                            {it.optionCount === 1 ? "" : "s"})
                          </span>
                        )}
                        {it.alreadyExists && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted bg-paper rounded px-1.5 py-0.5">
                            already exists — will be skipped
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted shrink-0">
                        {formatCents(it.priceCents, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2 border-t border-line">
            <button
              disabled={pending || !!blocked}
              onClick={confirmImport}
              className="rounded-xl bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
            >
              {pending ? "Importing…" : `Import ${preview.rowCount} item${preview.rowCount === 1 ? "" : "s"}`}
            </button>
            <button
              disabled={pending}
              onClick={reset}
              className="rounded-xl border border-line px-4 py-2.5 text-sm disabled:opacity-50"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {result && "error" in result && (
        <p className="rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
          {result.error}
        </p>
      )}

      {result && "ok" in result && (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-2">
            Done
          </h2>
          <p className="text-sm text-ink-soft">
            {result.categoriesCreated} categor{result.categoriesCreated === 1 ? "y" : "ies"}{" "}
            created, {result.itemsCreated} item{result.itemsCreated === 1 ? "" : "s"} added
            {result.itemsSkipped > 0
              ? `, ${result.itemsSkipped} skipped (already on your menu)`
              : ""}
            .
          </p>
          <div className="flex gap-2 mt-4">
            <a
              href="/dashboard/menu"
              className="rounded-xl bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep"
            >
              Go to menu
            </a>
            <button
              onClick={reset}
              className="rounded-xl border border-line px-4 py-2.5 text-sm"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
