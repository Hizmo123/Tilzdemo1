"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder, refireTicketItems } from "./actions";
import { staffSetAvailable } from "../menu/actions";
import type { OrderStatusName } from "@/lib/bills";

type TicketItem = {
  id: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
  allergens: string[];
  available: boolean;
  note: string | null;
};

export type Ticket = {
  id: string;
  orderNumber: number | null;
  tableLabel: string;
  billId: string;
  status: OrderStatusName;
  source: string;
  isRefire: boolean;
  note: string | null;
  prepay: boolean;
  billPaid: boolean;
  minutesAgo: number;
  items: TicketItem[];
};

export const NEXT_LABEL: Partial<Record<OrderStatusName, { to: OrderStatusName; label: string }>> = {
  SUBMITTED: { to: "PREPARING", label: "Start preparing" },
  PREPARING: { to: "READY", label: "Mark ready" },
  READY: { to: "SERVED", label: "Mark served" },
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  PREPARING: "bg-blue-50 text-blue-700",
  READY: "bg-pine-soft text-pine-deep",
};

export function KitchenTicket({
  slug,
  ticket,
  shortcutNumber,
}: {
  slug: string;
  ticket: Ticket;
  shortcutNumber?: number;
}) {
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

  function eighty6(menuItemId: string) {
    setError(null);
    start(async () => {
      const res = await staffSetAvailable(slug, menuItemId, false);
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  function refireLine(billItemId: string, name: string) {
    setError(null);
    start(async () => {
      const res = await refireTicketItems(slug, [billItemId], `Re-fire: ${name}`);
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
        <span className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
          {shortcutNumber && (
            <span
              title={`Press ${shortcutNumber} to bump this ticket`}
              className="shrink-0 w-6 h-6 rounded-full bg-paper border border-line text-xs font-medium flex items-center justify-center text-muted"
            >
              {shortcutNumber}
            </span>
          )}
          {ticket.orderNumber != null && (
            <span className="text-muted">#{ticket.orderNumber} · </span>
          )}
          {ticket.tableLabel}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {ticket.isRefire && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-danger-soft text-danger font-semibold">
              ↻ Re-fire
            </span>
          )}
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

      <ul className="space-y-2 mb-3 flex-1">
        {ticket.items.map((it) => (
          <li key={it.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">
                <span className="font-medium tabular-nums">{it.quantity}×</span> {it.name}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {it.menuItemId && it.available && (
                  <button
                    disabled={pending}
                    onClick={() => eighty6(it.menuItemId!)}
                    title="86 this item — mark sold out"
                    className="text-[10px] rounded border border-line px-1.5 py-0.5 text-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
                  >
                    86
                  </button>
                )}
                <button
                  disabled={pending}
                  onClick={() => refireLine(it.id, it.name)}
                  title="Re-fire — needs re-cooking"
                  className="text-[10px] rounded border border-line px-1.5 py-0.5 text-muted hover:border-ink/30 disabled:opacity-50"
                >
                  ↻
                </button>
              </span>
            </div>
            {it.note && (
              <p className="mt-0.5 text-xs text-amber-800 bg-amber-50 rounded px-2 py-0.5 inline-block">
                Note: {it.note}
              </p>
            )}
            {/* Allergens must be unmissable, not a small grey tag — this is a
                safety warning, not metadata. */}
            {it.allergens.length > 0 && (
              <p className="mt-0.5 text-xs font-semibold text-danger bg-danger-soft rounded px-2 py-1 inline-block">
                ⚠ Contains: {it.allergens.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>

      {ticket.note && (
        <p className="mb-3 rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2 border border-amber-200">
          <span className="font-semibold">Note:</span> {ticket.note}
        </p>
      )}

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      <div className="flex gap-2">
        {next && (
          <button
            disabled={pending}
            onClick={() => move(next.to)}
            className="flex-1 rounded-lg bg-pine text-white py-3 text-base font-medium hover:bg-pine-deep disabled:opacity-50 min-h-[48px]"
          >
            {pending ? "…" : next.label}
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => move("CANCELLED")}
          className="rounded-lg border border-line px-3 py-3 text-sm text-muted hover:text-danger hover:border-danger/40 disabled:opacity-50 min-h-[48px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
