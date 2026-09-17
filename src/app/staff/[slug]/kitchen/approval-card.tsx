"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOrder, rejectOrder } from "./actions";

type Pending = {
  id: string;
  orderNumber: number | null;
  tableLabel: string;
  minutesAgo: number;
  note: string | null;
  items: { id: string; name: string; quantity: number; note: string | null }[];
};

// A customer order held for staff approval. Accept sends it to the kitchen;
// Reject cancels it and takes the items off the bill.
export function ApprovalCard({
  slug,
  order,
}: {
  slug: string;
  order: Pending;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<{ error?: string } | { ok: true }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border-2 border-amber-300 bg-amber-50/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-lg font-semibold tracking-tight">
          {order.orderNumber != null && (
            <span className="text-amber-700">#{order.orderNumber} · </span>
          )}
          Table {order.tableLabel}
        </span>
        <span className="text-xs text-muted">
          {order.minutesAgo === 0 ? "just now" : `${order.minutesAgo} min ago`}
        </span>
      </div>

      <ul className="space-y-1 mb-3">
        {order.items.map((it) => (
          <li key={it.id} className="text-sm">
            <span className="font-medium tabular-nums">{it.quantity}×</span>{" "}
            {it.name}
            {it.note && <span className="block text-xs text-amber-800">Note: {it.note}</span>}
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="mb-3 rounded-lg bg-amber-100 text-amber-800 text-sm px-3 py-2">
          <span className="font-semibold">Note:</span> {order.note}
        </p>
      )}

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => act(() => approveOrder(slug, order.id))}
          className="flex-1 rounded-lg bg-pine text-[color:var(--on-accent,#fff)] py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
        >
          {pending ? "…" : "Accept"}
        </button>
        <button
          disabled={pending}
          onClick={() => act(() => rejectOrder(slug, order.id))}
          className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-danger hover:border-danger/40 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
