"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "./privacy-actions";

// INTERIM (Phase 2): one-step name confirmation wired straight to the new
// immediate-deletion action, so this phase builds on its own. Phase 3
// replaces the whole delete block with the three-step warning -> confirm ->
// final-confirmation flow.
export function PrivacyDataSection({
  organizationName,
  isOwner,
}: {
  organizationName: string;
  isOwner: boolean;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submitDelete() {
    setError(null);
    start(async () => {
      const res = await deleteAccountAction(confirmName);
      if (res.error) setError(res.error);
      else window.location.assign("/account-closed");
    });
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Your data</h2>
        <p className="text-sm text-muted mt-1">
          Export what Tillz holds about your venue, or close your account.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Export your data</p>
        <p className="text-sm text-muted mb-2">
          Your venues, floor plan, menu and staff list as a JSON file. Bill
          and payment history is available separately as a dated CSV from{" "}
          <a href="/dashboard/invoices" className="text-pine hover:underline">
            Invoices
          </a>
          .
        </p>
        <a
          href="/dashboard/settings/export"
          className="inline-block text-sm rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
        >
          Download export
        </a>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm font-medium mb-1 text-danger">Delete your account</p>
        {!isOwner ? (
          <p className="text-sm text-muted">Only the owner can do this.</p>
        ) : !confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm text-danger underline underline-offset-2"
          >
            Delete account…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Type <strong className="text-ink">{organizationName}</strong> to confirm. This
              closes the account immediately and can&apos;t be undone.
            </p>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2 text-sm focus:border-danger focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                disabled={pending || confirmName.trim() !== organizationName}
                onClick={submitDelete}
                className="rounded-[var(--radius-sm)] bg-danger text-white px-3.5 py-2 text-sm font-medium disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete account"}
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  setConfirmName("");
                  setError(null);
                }}
                className="rounded-[var(--radius-sm)] border border-line px-3.5 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-danger mt-2">{error}</p>}
      </div>
    </section>
  );
}
