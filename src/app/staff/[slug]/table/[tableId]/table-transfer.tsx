"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { staffMoveBill, staffMergeBills } from "./actions";

export type TransferTarget = {
  id: string;
  label: string;
  section: string | null;
  hasOpenBill: boolean;
};

// Lets staff move a bill to an empty table (guest changed seats) or merge it
// into another table's open bill (two tables joined, or a partial payment
// needs folding into the group's tab). Kept as two explicit actions rather
// than one "combine tables" control since they do different things to money
// already on the bill — see moveBill/mergeBills in lib/bills.ts.
export function TableTransfer({
  slug,
  billId,
  targets,
}: {
  slug: string;
  billId: string;
  targets: TransferTarget[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"move" | "merge" | null>(null);
  const [choice, setChoice] = useState("");

  const moveTargets = targets.filter((t) => !t.hasOpenBill);
  const mergeTargets = targets.filter((t) => t.hasOpenBill);

  function close() {
    setMode(null);
    setChoice("");
    setError(null);
  }

  function confirm() {
    if (!choice) return;
    setError(null);
    start(async () => {
      const res =
        mode === "move"
          ? await staffMoveBill(slug, billId, choice)
          : await staffMergeBills(slug, billId, choice);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  if (mode) {
    const options = mode === "move" ? moveTargets : mergeTargets;
    return (
      <div className="mt-3 rounded-lg border border-line bg-paper p-3 space-y-2">
        <p className="text-xs font-medium text-ink-soft">
          {mode === "move" ? "Move this bill to…" : "Merge this bill into…"}
        </p>
        {options.length === 0 ? (
          <p className="text-xs text-muted">
            {mode === "move"
              ? "No empty tables available."
              : "No other open bills to merge with."}
          </p>
        ) : (
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
          >
            <option value="">Select a table…</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.section ? `${t.section} · ` : ""}
                {t.label}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <button
            disabled={pending || !choice}
            onClick={confirm}
            className="rounded-lg bg-ink text-paper px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Working…" : mode === "move" ? "Move" : "Merge"}
          </button>
          <button
            disabled={pending}
            onClick={close}
            className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={() => setMode("move")}
        className="text-xs text-muted hover:text-ink underline underline-offset-2"
      >
        Move table…
      </button>
      <button
        onClick={() => setMode("merge")}
        className="text-xs text-muted hover:text-ink underline underline-offset-2"
      >
        Merge with…
      </button>
    </div>
  );
}
