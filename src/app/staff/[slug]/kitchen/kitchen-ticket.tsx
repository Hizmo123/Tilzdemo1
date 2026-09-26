"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder, refireTicketItems } from "./actions";
import { staffSetAvailable } from "../menu/actions";
import type { OrderStatusName } from "@/lib/bills";
import { buttonClasses } from "@/components/ui/button-classes";

export type TicketItem = {
  id: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
  allergens: string[];
  available: boolean;
  note: string | null;
  station: string | null;
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
  // The station this card is filed under on the board (null = unfiltered).
  station: string | null;
  items: TicketItem[];
};

// Ticket-age escalation, in one place for the board AND the pass view:
// fresh = info, approaching AGE_WARN = warn, past AGE_OVERDUE = danger.
// Same tokens the staff Floor uses, so a colour means the same thing on
// every staff screen. Venue-configurable thresholds would be a settings
// change (data), out of scope for this polish pass — change them here.
export const AGE_WARN_MINUTES = 5;
export const AGE_OVERDUE_MINUTES = 10;

export function ageAccentClass(minutesAgo: number, active = true): string {
  if (!active) return "border-l-line-strong";
  if (minutesAgo >= AGE_OVERDUE_MINUTES) return "border-l-danger";
  if (minutesAgo >= AGE_WARN_MINUTES) return "border-l-warn";
  return "border-l-info";
}

export const NEXT_LABEL: Partial<Record<OrderStatusName, { to: OrderStatusName; label: string }>> = {
  SUBMITTED: { to: "PREPARING", label: "Start preparing" },
  PREPARING: { to: "READY", label: "Mark ready" },
  READY: { to: "SERVED", label: "Mark served" },
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-warn-soft text-warn",
  PREPARING: "bg-info-soft text-info",
  READY: "bg-pine-soft text-pine-deep",
};

export function KitchenTicket({
  slug,
  ticket,
  shortcutNumber,
  // Connect-tier orgs: Square owns the kitchen, not Tillz — see the
  // matching comment on dashboard/orders/dashboard-ticket.tsx. Only
  // Start/Ready/Served/Cancel are hidden (the status-advance controls);
  // 86 and re-fire stay, since those don't pretend to move an order's
  // status and remain genuinely useful for staff working the floor.
  readOnly = false,
}: {
  slug: string;
  ticket: Ticket;
  shortcutNumber?: number;
  readOnly?: boolean;
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

  // Age escalation — a ticket sitting too long turns warn then danger so it's
  // obvious across the kitchen. Only applies while it's still being worked.
  // Left-edge accent only (never the whole background) so the ticket text
  // stays legible under kitchen lighting.
  const active = ticket.status === "SUBMITTED" || ticket.status === "PREPARING";
  const ageBorder = `border-l-4 ${ageAccentClass(ticket.minutesAgo, active)}`;

  return (
    <div
      className={`rounded-[var(--radius-card)] border border-line ${ageBorder} bg-surface shadow-rest p-4 flex flex-col`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
          {shortcutNumber && (
            <span
              title={`Press ${shortcutNumber} to bump this ticket`}
              className="shrink-0 w-6 h-6 rounded-pill bg-paper border border-line text-xs font-medium flex items-center justify-center text-muted"
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
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-danger-soft text-danger font-semibold">
              ↻ Re-fire
            </span>
          )}
          {ticket.prepay && (
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] font-semibold ${
                ticket.billPaid
                  ? "bg-pine-soft text-pine-deep"
                  : "bg-danger-soft text-danger"
              }`}
            >
              {ticket.billPaid ? "Paid" : "Unpaid"}
            </span>
          )}
          <span
            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] ${
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
                    className="text-[10px] rounded-[var(--radius-xs)] border border-line px-1.5 py-0.5 text-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
                  >
                    86
                  </button>
                )}
                <button
                  disabled={pending}
                  onClick={() => refireLine(it.id, it.name)}
                  title="Re-fire — needs re-cooking"
                  className="text-[10px] rounded-[var(--radius-xs)] border border-line px-1.5 py-0.5 text-muted hover:border-ink/30 disabled:opacity-50"
                >
                  ↻
                </button>
              </span>
            </div>
            {it.note && (
              <p className="mt-0.5 text-xs text-warn bg-warn-soft rounded-[var(--radius-xs)] px-2 py-0.5 inline-block">
                Note: {it.note}
              </p>
            )}
            {/* Allergens must be unmissable, not a small grey tag — this is a
                safety warning, not metadata. */}
            {it.allergens.length > 0 && (
              <p className="mt-0.5 text-xs font-semibold text-danger bg-danger-soft rounded-[var(--radius-xs)] px-2 py-1 inline-block">
                ⚠ Contains: {it.allergens.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>

      {ticket.note && (
        <p className="mb-3 rounded-[var(--radius-sm)] bg-warn-soft text-warn text-sm px-3 py-2 border border-warn/40">
          <span className="font-semibold">Note:</span> {ticket.note}
        </p>
      )}

      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      {readOnly ? (
        <p className="text-sm text-muted text-center py-2.5 border-t border-line">
          Synced from your Square kitchen
        </p>
      ) : (
        {/* Bump-bar convention: ONE big full-width tap to advance, at the
            bottom of the card where a thumb lands. Cancel is deliberately
            small and separate so a rushed bump can't hit it. */}
        <div className="space-y-1.5">
          {next && (
            <button
              disabled={pending}
              onClick={() => move(next.to)}
              className={buttonClasses("primary", "lg", true, "h-14 text-lg disabled:opacity-50")}
            >
              {pending ? "…" : next.label}
            </button>
          )}
          <button
            disabled={pending}
            onClick={() => move("CANCELLED")}
            className={buttonClasses("ghost", "sm", true, "text-muted hover:text-danger hover:bg-danger-soft disabled:opacity-50")}
          >
            Cancel ticket
          </button>
        </div>
      )}
    </div>
  );
}
