"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceOrderFromDashboard } from "./actions";
import type { OrderStatusName } from "@/lib/bills";

type Ticket = {
  id: string;
  tableLabel: string;
  status: OrderStatusName;
  source: string;
  minutesAgo: number;
  items: { id: string; name: string; quantity: number; note: string | null }[];
};

const NEXT_LABEL: Partial<Record<OrderStatusName, { to: OrderStatusName; label: string }>> = {
  SUBMITTED: { to: "PREPARING", label: "Start" },
  PREPARING: { to: "READY", label: "Ready" },
  READY: { to: "SERVED", label: "Served" },
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  PREPARING: "bg-blue-50 text-blue-700",
  READY: "bg-pine-soft text-pine-deep",
};

export function DashboardTicket({
  ticket,
  // Connect-tier orgs: Square owns the kitchen, not Tillz — the only thing
  // that ever advances one of these orders' status is the
  // order.fulfillment.updated webhook sync (lib/bills.ts). A manual button
  // here would look real but do nothing the venue's own Square KDS/POS
  // cares about, so it's replaced with a plain status badge instead.
  readOnly = false,
}: {
  ticket: Ticket;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(to: OrderStatusName) {
    setError(null);
    start(async () => {
      const res = await advanceOrderFromDashboard(ticket.id, to);
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  const next = NEXT_LABEL[ticket.status];

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="font-display text-lg font-semibold tracking-tight">
          Table {ticket.tableLabel}
        </span>
        <span
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
            STATUS_STYLE[ticket.status] ?? "bg-paper text-muted"
          }`}
        >
          {ticket.status.toLowerCase()}
        </span>
      </div>
      <p className="text-xs text-muted mb-3">
        {ticket.minutesAgo === 0 ? "just now" : `${ticket.minutesAgo} min ago`}
        {ticket.source === "STAFF" ? " · staff" : ""}
      </p>
      <ul className="space-y-1 mb-3">
        {ticket.items.map((it) => (
          <li key={it.id} className="text-sm">
            <span className="font-medium tabular-nums">{it.quantity}×</span>{" "}
            {it.name}
            {it.note && <span className="block text-xs text-amber-800">Note: {it.note}</span>}
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}
      {readOnly ? (
        <p className="text-xs text-muted text-center py-2 border-t border-line">
          Synced from your Square kitchen
        </p>
      ) : (
        next && (
          <button
            disabled={pending}
            onClick={() => move(next.to)}
            className="w-full rounded-lg bg-pine text-white py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
          >
            {pending ? "…" : next.label}
          </button>
        )
      )}
    </div>
  );
}
