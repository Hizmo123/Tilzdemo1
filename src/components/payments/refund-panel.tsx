"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents, dollarsToCents } from "@/lib/money";

export type RefundablePayment = {
  id: string;
  amountCents: number;
  tipCents: number;
  surchargeCents: number;
  refundedCents: number;
  currency: string;
  provider: string;
  test: boolean;
  createdAt: string;
};

// Lets staff/owners refund a specific payment, full or partial, with a reason.
// Used from both the staff table screen (an open bill's payments so far) and
// the owner's bill/tax-invoice view (a paid bill's full payment history) —
// the actual refund call is injected so each context can wire its own
// permission-gated server action.
export function RefundPanel({
  payments,
  onRefund,
}: {
  payments: RefundablePayment[];
  onRefund: (
    paymentId: string,
    amountCents: number,
    reason: string,
  ) => Promise<{ ok: true } | { error: string }>;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refundable = payments
    .map((p) => ({
      ...p,
      refundableCents: p.amountCents + p.tipCents + p.surchargeCents - p.refundedCents,
    }))
    .filter((p) => p.refundableCents > 0);

  if (refundable.length === 0) return null;

  function open(p: (typeof refundable)[number]) {
    setOpenId(p.id);
    setAmountStr((p.refundableCents / 100).toString());
    setReason("");
    setError(null);
  }

  function close() {
    setOpenId(null);
    setError(null);
  }

  function confirm(p: (typeof refundable)[number]) {
    const cents = dollarsToCents(amountStr);
    if (cents === null || cents <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (cents > p.refundableCents) {
      setError(`Only ${formatCents(p.refundableCents, p.currency)} can be refunded here.`);
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await onRefund(p.id, cents, reason.trim());
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-ink-soft">Payments</p>
      {refundable.map((p) => (
        <div key={p.id} className="rounded-lg border border-line p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p>
                {formatCents(p.amountCents + p.tipCents + p.surchargeCents, p.currency)}
                {p.test && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted">
                    test
                  </span>
                )}
              </p>
              {p.refundedCents > 0 && (
                <p className="text-xs text-muted">
                  {formatCents(p.refundedCents, p.currency)} already refunded
                </p>
              )}
            </div>
            {openId !== p.id && (
              <button
                onClick={() => open(p)}
                className="shrink-0 text-xs text-muted hover:text-danger underline underline-offset-2"
              >
                Refund…
              </button>
            )}
          </div>

          {openId === p.id && (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <div>
                <label className="text-xs text-muted block mb-1">Refund amount ($)</label>
                <input
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Reason</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Order was wrong, guest left early"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  onClick={() => confirm(p)}
                  className="rounded-lg bg-danger text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pending ? "Refunding…" : "Confirm refund"}
                </button>
                <button
                  disabled={pending}
                  onClick={close}
                  className="rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
