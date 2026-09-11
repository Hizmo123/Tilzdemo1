"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder, markPickupPaid } from "./actions";
import type { OrderStatusName } from "@/lib/bills";

type Ticket = {
  id: string;
  orderNumber: number | null;
  tableLabel: string;
  isTakeaway: boolean;
  billId: string;
  status: OrderStatusName;
  source: string;
  note: string | null;
  prepay: boolean;
  billPaid: boolean;
  minutesAgo: number;
  items: { id: string; name: string; quantity: number }[];
};

const NEXT_LABEL: Partial<Record<OrderStatusName, { to: OrderStatusName; label: string }>> = {
  SUBMITTED: { to: "PREPARING", label: "Start preparing" },
  PREPARING: { to: "READY", label: "Mark ready" },
  READY: { to: "SERVED", label: "Mark served" },
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  PREPARING: "bg-blue-50 text-blue-700",
  READY: "bg-pine-soft text-pine-deep",
};

export function KitchenTicket({ slug, ticket }: { slug: string; ticket: Ticket }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(to: OrderStatusName) {
    setError(null);
    start(async () => {
      const res = await advanceOrder(slug, ticket.id, to);
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  const next = NEXT_LABEL[ticket.status];

  // Age escalation — a ticket sitting too long turns amber then red so it's
  // obvious across the kitchen. Only applies while it's still being worked.
  const active = ticket.status === "SUBMITTED" || ticket.status === "PREPARING";
  const ageBorder =
    active && ticket.minutesAgo >= 10
      ? "border-l-4 border-l-danger"
      : active && ticket.minutesAgo >= 5
        ? "border-l-4 border-l-amber-500"
        : "border-l-4 border-l-pine";

  return (
    <div
      className={`rounded-[var(--radius-card)] border border-line ${ageBorder} bg-surface p-4 flex flex-col`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-display text-lg font-semibold tracking-tight">
          {ticket.orderNumber != null && (
            <span className="text-muted">#{ticket.orderNumber} · </span>
          )}
          {ticket.tableLabel}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {ticket.prepay && (
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${
                ticket.billPaid
                  ? "bg-pine-soft text-pine-deep"
                  : "bg-danger-soft text-danger"
              }`}
            >
              {ticket.billPaid ? "Paid" : "Unpaid"}
            </span>
          )}
          <span
            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
              STATUS_STYLE[ticket.status] ?? "bg-paper text-muted"
            }`}
          >
            {ticket.status.toLowerCase()}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted mb-3">
        {ticket.minutesAgo === 0 ? "just now" : `${ticket.minutesAgo} min ago`}
        {ticket.source === "STAFF" ? " · staff" : ""}
      </p>

      <ul className="space-y-1 mb-3 flex-1">
        {ticket.items.map((it) => (
          <li key={it.id} className="text-sm">
            <span className="font-medium tabular-nums">{it.quantity}×</span>{" "}
            {it.name}
          </li>
        ))}
      </ul>

      {ticket.note && (
        <p className="mb-3 rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2 border border-amber-200">
          <span className="font-semibold">Note:</span> {ticket.note}
        </p>
      )}

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      {ticket.isTakeaway && !ticket.billPaid && (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await markPickupPaid(slug, ticket.billId);
              if (res && "error" in res && res.error) setError(res.error);
              else router.refresh();
            })
          }
          className="mb-2 w-full rounded-lg border border-pine text-pine-deep py-2 text-sm font-medium hover:bg-pine-soft disabled:opacity-50"
        >
          {pending ? "…" : "Mark paid (counter)"}
        </button>
      )}

      <div className="flex gap-2">
        {next && (
          <button
            disabled={pending}
            onClick={() => move(next.to)}
            className="flex-1 rounded-lg bg-pine text-white py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
          >
            {pending ? "…" : next.label}
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => move("CANCELLED")}
          className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-danger hover:border-danger/40 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
