"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TenderType } from "@prisma/client";
import { closeCounterSale } from "../actions";
import { formatCents } from "@/lib/money";

const TENDERS: { value: TenderType; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

export function TakePaymentButton({
  slug,
  billId,
  remainingCents,
  currency,
  cashAvailable,
}: {
  slug: string;
  billId: string;
  remainingCents: number;
  currency: string;
  // Whether an open drawer session exists for this sale's location — Cash
  // is disabled without one (see lib/bills.ts's tender check, which rejects
  // it server-side too; this is just so staff aren't offered a choice the
  // server will refuse).
  cashAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tender, setTender] = useState<TenderType | null>(null);

  function pay(tenderType: TenderType) {
    setError(null);
    start(async () => {
      const res = await closeCounterSale(slug, billId, tenderType);
      if (res && "error" in res && res.error) setError(res.error);
      else router.push(`/staff/${slug}/counter`);
    });
  }

  return (
    <div className="mt-4">
      {tender ? (
        <div className="flex items-center gap-2">
          <button
            disabled={pending}
            onClick={() => pay(tender)}
            className="rounded-lg bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-60"
          >
            {pending
              ? "Recording…"
              : `Confirm ${tender.toLowerCase()} — take ${formatCents(remainingCents, currency)}`}
          </button>
          <button
            disabled={pending}
            onClick={() => setTender(null)}
            className="rounded-lg border border-line px-4 py-2.5 text-sm hover:border-ink/30"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted mb-2">Take payment (counter / cash)</p>
          <div className="flex items-center gap-2 flex-wrap">
            {TENDERS.map((t) => {
              const disabled = t.value === "CASH" && !cashAvailable;
              return (
                <button
                  key={t.value}
                  type="button"
                  disabled={disabled}
                  title={disabled ? "Open the drawer to take cash" : undefined}
                  onClick={() => setTender(t.value)}
                  className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:border-pine/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-line"
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {!cashAvailable && (
            <p className="text-xs text-muted mt-1.5">Open the drawer to take cash.</p>
          )}
        </div>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
