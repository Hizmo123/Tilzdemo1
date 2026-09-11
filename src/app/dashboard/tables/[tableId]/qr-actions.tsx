"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateQr, setTableActive } from "../actions";

export function QrActions({
  tableId,
  active,
}: {
  tableId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Manage
        </h2>
        <p className="text-sm text-muted">
          Regenerating makes the old printed QR stop working.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {confirmRegen ? (
          <>
            <button
              disabled={pending}
              onClick={() => {
                setConfirmRegen(false);
                run(() => regenerateQr(tableId));
              }}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {pending ? "Regenerating…" : "Confirm regenerate"}
            </button>
            <button
              disabled={pending}
              onClick={() => setConfirmRegen(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-ink/30 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            disabled={pending}
            onClick={() => setConfirmRegen(true)}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-ink/30 disabled:opacity-60 transition-colors"
          >
            Regenerate QR
          </button>
        )}

        <button
          disabled={pending}
          onClick={() => run(() => setTableActive(tableId, !active))}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-ink/30 disabled:opacity-60 transition-colors"
        >
          {active ? "Deactivate table" : "Reactivate table"}
        </button>
      </div>
    </div>
  );
}
