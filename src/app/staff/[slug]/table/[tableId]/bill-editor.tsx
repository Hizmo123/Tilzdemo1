"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents, dollarsToCents } from "@/lib/money";
import { staffVoidItem, staffCompItem, staffSetDiscount } from "./actions";

type Item = {
  id: string;
  nameSnapshot: string;
  quantity: number;
  lineTotalCents: number;
  voided: boolean;
  comped: boolean;
  modifiers: { name: string }[] | null;
};

// Staff view of the current bill with adjustment controls: void a line (removed
// from the total), comp it (kept but charged $0), or apply a bill discount.
export function BillEditor({
  slug,
  tableId,
  billId,
  currency,
  items,
  subtotalCents,
  discountCents,
  totalCents,
  remainingCents,
}: {
  slug: string;
  tableId: string;
  billId: string;
  currency: string;
  items: Item[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  remainingCents: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [discountStr, setDiscountStr] = useState(
    discountCents > 0 ? (discountCents / 100).toString() : "",
  );

  function run(fn: () => Promise<{ error?: string } | { ok: true }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  function applyDiscount() {
    const cents = discountStr.trim() === "" ? 0 : dollarsToCents(discountStr);
    if (cents === null) {
      setError("Enter a valid discount, e.g. 5 or 5.50.");
      return;
    }
    run(() => staffSetDiscount(slug, tableId, billId, cents));
  }

  return (
    <div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className={`text-sm ${it.voided ? "line-through text-muted" : ""}`}
              >
                {it.quantity > 1 && (
                  <span className="text-muted">{it.quantity}× </span>
                )}
                {it.nameSnapshot}
                {it.comped && !it.voided && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-pine-deep bg-pine-soft rounded px-1 py-0.5">
                    Comp
                  </span>
                )}
              </span>
              {it.modifiers && it.modifiers.length > 0 && (
                <span className="block text-xs text-muted">
                  {it.modifiers.map((m) => m.name).join(", ")}
                </span>
              )}
              <div className="flex gap-3 mt-1">
                <button
                  disabled={pending}
                  onClick={() =>
                    run(() => staffVoidItem(slug, tableId, it.id, !it.voided))
                  }
                  className="text-xs text-muted hover:text-danger disabled:opacity-50"
                >
                  {it.voided ? "Un-void" : "Void"}
                </button>
                {!it.voided && (
                  <button
                    disabled={pending}
                    onClick={() =>
                      run(() => staffCompItem(slug, tableId, it.id, !it.comped))
                    }
                    className="text-xs text-muted hover:text-ink disabled:opacity-50"
                  >
                    {it.comped ? "Un-comp" : "Comp"}
                  </button>
                )}
              </div>
            </div>
            <span
              className={`tabular-nums shrink-0 text-sm ${
                it.voided || it.comped ? "text-muted line-through" : ""
              }`}
            >
              {formatCents(it.lineTotalCents, currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-line mt-3 pt-3 space-y-1 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCents(subtotalCents, currency)}</span>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-muted">
            <span>Discount</span>
            <span className="tabular-nums">
              −{formatCents(discountCents, currency)}
            </span>
          </div>
        )}
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatCents(totalCents, currency)}</span>
        </div>
        {totalCents - remainingCents > 0 && (
          <div className="flex justify-between text-muted">
            <span>Remaining</span>
            <span className="tabular-nums">{formatCents(remainingCents, currency)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted block mb-1">Bill discount ($)</label>
          <input
            inputMode="decimal"
            value={discountStr}
            onChange={(e) => setDiscountStr(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
          />
        </div>
        <button
          disabled={pending}
          onClick={applyDiscount}
          className="rounded-lg border border-line px-3 py-2 text-sm hover:border-ink/30 disabled:opacity-50"
        >
          Apply
        </button>
      </div>

      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}
