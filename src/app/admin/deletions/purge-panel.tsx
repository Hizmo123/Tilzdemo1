"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purgeDeletedOrgAction } from "./actions";
import { PURGE_CONFIRMATION } from "@/lib/admin/purge-confirmation";

type Retained = { bills: number; payments: number; refunds: number; orders: number; standOrders: number };

// Two clicks and a typed word for something that can't be undone: "Purge
// now" (only enabled once the retention date has passed) opens a panel that
// spells out exactly what will be destroyed, and the final button stays
// disabled until DELETE is typed. The server re-checks eligibility and the
// typed word regardless — this UI is not the gate.
export function PurgePanel({
  orgId,
  orgName,
  eligible,
  eligibleOn,
  retained,
}: {
  orgId: string;
  orgName: string;
  eligible: boolean;
  eligibleOn: string;
  retained: Retained;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function purge() {
    setError(null);
    start(async () => {
      const res = await purgeDeletedOrgAction(orgId, typed);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={!eligible}
        onClick={() => setOpen(true)}
        title={eligible ? undefined : `Records must be retained until ${eligibleOn}`}
        className="text-xs rounded-[var(--radius-xs)] border border-danger/40 text-danger px-2.5 py-1.5 hover:bg-danger-soft disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        Purge now
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Purge ${orgName}`}
      className="w-full max-w-md rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft/50 p-4 shadow-raised space-y-3"
    >
      <p className="text-sm text-ink">
        This permanently deletes <strong>{orgName}</strong> and everything still retained for it:{" "}
        <strong className="tabular-nums">{retained.bills}</strong> bills,{" "}
        <strong className="tabular-nums">{retained.payments}</strong> payments,{" "}
        <strong className="tabular-nums">{retained.refunds}</strong> refunds,{" "}
        <strong className="tabular-nums">{retained.orders}</strong> orders and{" "}
        <strong className="tabular-nums">{retained.standOrders}</strong> stand orders, plus its venues, tables and
        memberships. <strong>It can&apos;t be undone.</strong>
      </p>
      <div>
        <label htmlFor={`purge-${orgId}`} className="block text-xs text-muted mb-1">
          Type <span className="font-mono text-ink">{PURGE_CONFIRMATION}</span> to confirm
        </label>
        <input
          id={`purge-${orgId}`}
          autoFocus
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full h-9 rounded-[var(--radius-sm)] border border-danger/40 bg-surface px-3 text-sm font-mono shadow-rest focus:outline-none focus:border-danger focus:ring-[3px] focus:ring-danger/20"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending || typed !== PURGE_CONFIRMATION}
          onClick={purge}
          className="text-xs rounded-[var(--radius-xs)] bg-danger text-white px-2.5 py-1.5 disabled:opacity-50"
        >
          {pending ? "Purging…" : "Purge permanently"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
          className="text-xs rounded-[var(--radius-xs)] border border-line px-2.5 py-1.5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
