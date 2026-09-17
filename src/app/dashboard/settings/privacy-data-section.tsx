"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestDeletionAction, cancelDeletionAction } from "./privacy-actions";

export function PrivacyDataSection({
  organizationName,
  isOwner,
  deletionRequestedAt,
}: {
  organizationName: string;
  isOwner: boolean;
  deletionRequestedAt: string | null;
}) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submitRequest() {
    setError(null);
    start(async () => {
      const res = await requestDeletionAction(confirmName);
      if (res.error) setError(res.error);
      else {
        setConfirming(false);
        setConfirmName("");
        router.refresh();
      }
    });
  }

  function cancel() {
    setError(null);
    start(async () => {
      const res = await cancelDeletionAction();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Your data
        </h2>
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
          className="inline-block text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
        >
          Download export
        </a>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm font-medium mb-1 text-danger">Delete your account</p>
        {deletionRequestedAt ? (
          <div className="rounded-lg bg-danger-soft text-danger px-3.5 py-3 text-sm space-y-2">
            <p>
              Deletion requested on{" "}
              {new Date(deletionRequestedAt).toLocaleDateString("en-AU")}. Your
              account keeps working normally — support will be in touch to
              finish closing it (paid bills are tax invoices we're required to
              keep for 5 years, so those survive regardless).
            </p>
            {isOwner && (
              <button
                disabled={pending}
                onClick={cancel}
                className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium hover:bg-white/40 disabled:opacity-50"
              >
                Cancel request
              </button>
            )}
          </div>
        ) : !isOwner ? (
          <p className="text-sm text-muted">Only the owner can request this.</p>
        ) : !confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm text-danger underline underline-offset-2"
          >
            Request account deletion…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Type <strong className="text-ink">{organizationName}</strong> to
              confirm. This records a request — it doesn't delete anything
              immediately.
            </p>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm focus:border-danger focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={submitRequest}
                className="rounded-lg bg-danger text-white px-3.5 py-2 text-sm font-medium disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Confirm deletion request"}
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  setConfirmName("");
                  setError(null);
                }}
                className="rounded-lg border border-line px-3.5 py-2 text-sm disabled:opacity-50"
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
