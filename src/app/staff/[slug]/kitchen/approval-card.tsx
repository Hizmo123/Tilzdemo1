"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOrder, rejectOrder } from "./actions";
import { buttonClasses } from "@/components/ui/button-classes";

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
    <div className="rounded-[var(--radius-card)] border-2 border-warn/40 bg-warn-soft/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-lg font-semibold tracking-tight">
          {order.orderNumber != null && (
            <span className="text-warn">#{order.orderNumber} · </span>
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
            {it.note && <span className="block text-xs text-warn">Note: {it.note}</span>}
          </li>
        ))}
      </ul>

      {order.note && (
        <p className="mb-3 rounded-[var(--radius-sm)] bg-warn-soft text-warn text-sm px-3 py-2">
          <span className="font-semibold">Note:</span> {order.note}
        </p>
      )}

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => act(() => approveOrder(slug, order.id))}
          className={buttonClasses("primary", "lg", false, "flex-1 disabled:opacity-50")}
        >
          {pending ? "…" : "Accept"}
        </button>
        <button
          disabled={pending}
          onClick={() => act(() => rejectOrder(slug, order.id))}
          className={buttonClasses("secondary", "lg", false, "text-muted hover:text-danger hover:border-danger/40 disabled:opacity-50")}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
