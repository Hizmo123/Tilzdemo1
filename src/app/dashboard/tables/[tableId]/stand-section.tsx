"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveStand, deactivateStand } from "./stand-actions";

type OtherTable = { id: string; label: string };

export function StandSection({
  stand,
  otherTables,
  canManage,
}: {
  stand: { id: string; serial: string; status: string } | null;
  otherTables: OtherTable[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        setConfirmingDeactivate(false);
        router.refresh();
      }
    });
  }

  if (!stand) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Tillz stand
        </h2>
        <p className="text-sm text-muted">
          No physical stand assigned to this table yet — order one from{" "}
          <a href="/dashboard/tables/order-stands" className="text-pine hover:underline">
            Order physical stands
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">Tillz stand</h2>
        <span
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
            stand.status === "ACTIVE"
              ? "bg-pine-soft text-pine-deep"
              : stand.status === "DEACTIVATED"
                ? "bg-danger-soft text-danger"
                : "bg-paper text-muted"
          }`}
        >
          {stand.status}
        </span>
      </div>
      <p className="text-sm text-muted">Serial {stand.serial}</p>

      {canManage && stand.status !== "DEACTIVATED" && (
        <div className="space-y-3 pt-2 border-t border-line">
          {otherTables.length > 0 && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted block mb-1">Move to another table</label>
                <select
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
                >
                  <option value="">Select a table…</option>
                  {otherTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                disabled={pending || !moveTo}
                onClick={() => run(() => moveStand(stand.id, moveTo))}
                className="text-sm rounded-lg border border-line px-3.5 py-2 hover:border-ink/30 disabled:opacity-50"
              >
                Move
              </button>
            </div>
          )}

          {!confirmingDeactivate ? (
            <button
              disabled={pending}
              onClick={() => setConfirmingDeactivate(true)}
              className="text-sm text-danger underline underline-offset-2"
            >
              Report lost / deactivate…
            </button>
          ) : (
            <div className="rounded-lg bg-danger-soft text-danger px-3.5 py-3 text-sm space-y-2">
              <p>Its QR stops resolving immediately. This can&apos;t be undone from here.</p>
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  onClick={() => run(() => deactivateStand(stand.id))}
                  className="rounded-lg bg-danger text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Confirm deactivate
                </button>
                <button
                  disabled={pending}
                  onClick={() => setConfirmingDeactivate(false)}
                  className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
