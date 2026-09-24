"use client";

import { useState } from "react";

// Shared destructive-action gate: same pattern as
// components/admin/suspend-button.tsx — type an exact phrase before the
// confirm button enables, so an action that deletes real data can't go off
// on a single accidental click. Reused by the CSV importer's "Replace"
// mode and the menu page's "Delete whole menu" danger zone.
export function TypedDangerConfirm({
  confirmText,
  description,
  confirmLabel,
  pendingLabel = "Working…",
  pending,
  onConfirm,
  onCancel,
}: {
  // The exact string the admin must type — a restaurant name or a fixed
  // word like "REPLACE"/"DELETE", per the call site.
  confirmText: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === confirmText;

  return (
    <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft/40 p-4 space-y-3">
      <div className="text-sm text-ink">
        {description} Type <span className="font-semibold">{confirmText}</span> to confirm.
      </div>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={confirmText}
        disabled={pending}
        className="w-full rounded-[var(--radius-xs)] border border-line bg-surface px-3 py-2 text-sm focus:border-danger focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!matches || pending}
          onClick={onConfirm}
          className="text-sm rounded-[var(--radius-sm)] bg-danger text-white px-3.5 py-2 font-medium disabled:opacity-40"
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setTyped("");
            onCancel();
          }}
          className="text-sm text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
