"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeCounterSale } from "../actions";
import { formatCents } from "@/lib/money";

export function TakePaymentButton({
  slug,
  billId,
  remainingCents,
  currency,
}: {
  slug: string;
  billId: string;
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
      // TODO(task 4): replace this fixed "OTHER" with the tender the staff
      // member actually picks (Cash/Card/Other) — this button is rebuilt
      // into a tender-choice UI in the very next task.
      const res = await closeCounterSale(slug, billId, "OTHER");
      if (res && "error" in res && res.error) setError(res.error);
      else router.push(`/staff/${slug}/counter`);
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
              : `Confirm — take ${formatCents(remainingCents, currency)}`}
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
          Take payment (counter / cash)
        </button>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
