"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markBillPaid } from "./actions";
import { formatCents } from "@/lib/money";

export function MarkPaidButton({
  slug,
  tableId,
  remainingCents,
  currency,
}: {
  slug: string;
  tableId: string;
  remainingCents: number;
  currency: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  function pay() {
    setError(null);
    start(async () => {
      const res = await markBillPaid(slug, tableId);
      if (res && "error" in res && res.error) setError(res.error);
      else {
        setConfirm(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-4">
      {confirm ? (
        <div className="flex items-center gap-2">
          <button
            disabled={pending}
            onClick={pay}
            className="rounded-lg bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-60"
          >
            {pending
              ? "Recording…"
              : `Confirm — mark ${formatCents(remainingCents, currency)} paid`}
          </button>
          <button
            disabled={pending}
            onClick={() => setConfirm(false)}
            className="rounded-lg border border-line px-4 py-2.5 text-sm hover:border-ink/30"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:border-pine/50"
        >
          Mark as paid (counter / cash)
        </button>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
