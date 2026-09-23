"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TypedDangerConfirm } from "@/components/dashboard/typed-danger-confirm";
import { deleteWholeMenuAction } from "./actions";

// Clearly separated, deliberately unstyled-as-a-normal-card destructive
// section at the bottom of the menu page — same typed-confirmation pattern
// as the CSV importer's "Replace" mode (both ultimately call
// lib/menu-import.ts#deleteAllMenuData).
export function DangerZone({
  restaurantName,
  categoryCount,
}: {
  restaurantName: string;
  categoryCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    start(async () => {
      const res = await deleteWholeMenuAction();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border-2 border-danger/30 bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight text-danger mb-1">
        Danger zone
      </h2>
      <p className="text-sm text-muted mb-4">
        Permanently delete every category and item on this menu
        {categoryCount > 0 ? ` (${categoryCount} categor${categoryCount === 1 ? "y" : "ies"} today)` : ""}.
        This can&apos;t be undone — past orders keep their own record either way.
      </p>

      {confirming ? (
        <TypedDangerConfirm
          confirmText={restaurantName}
          description="This permanently deletes every category and item on this menu."
          confirmLabel="Delete whole menu"
          pendingLabel="Deleting…"
          pending={pending}
          onConfirm={run}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <button
          type="button"
          disabled={categoryCount === 0}
          onClick={() => setConfirming(true)}
          className="text-sm rounded-lg border border-danger/40 text-danger px-3.5 py-2 font-medium hover:bg-danger-soft disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete whole menu…
        </button>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
