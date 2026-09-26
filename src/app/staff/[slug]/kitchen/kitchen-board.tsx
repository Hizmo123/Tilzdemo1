"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder } from "./actions";
import { KitchenTicket, NEXT_LABEL, type Ticket } from "./kitchen-ticket";

// Wraps the ticket grid with number-key shortcuts (1-9, matching the numbered
// badge on each card) so a bump can happen without touching a greasy screen
// — a cheap wireless keypad mounted at the pass is a common kitchen setup.
// Ignored while any text input has focus (the device-label field, etc.) so
// typing a name doesn't accidentally bump a ticket.
export type TicketGroup = { station: string | null; tickets: Ticket[] };

export function KitchenBoard({
  slug,
  groups,
  // Connect-tier orgs: see kitchen-ticket.tsx's matching comment. Disables
  // the numeric bump shortcut too, not just the on-card buttons — the same
  // "does nothing real" rule applies to it.
  readOnly = false,
}: {
  slug: string;
  // Tickets filed by station (a single group when a station is selected or
  // the device is station-locked). Numbered shortcuts run across the
  // groups in display order, so "3" always means the third card on screen.
  groups: TicketGroup[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const tickets = groups.flatMap((g) => g.tickets);

  useEffect(() => {
    if (readOnly) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;
      const ticket = tickets[n - 1];
      if (!ticket) return;
      const next = NEXT_LABEL[ticket.status];
      if (!next) return;
      e.preventDefault();
      advanceOrder(slug, ticket.id, next.to).then(() => router.refresh());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tickets, slug, router, readOnly]);

  let index = 0;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.station ?? "__all"}>
          {g.station && groups.length > 1 && (
            <h2 className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{g.station}</span>
              <span className="text-xs text-muted tabular-nums rounded-pill bg-surface-2 px-2 py-0.5">
                {g.tickets.length}
              </span>
            </h2>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {g.tickets.map((t) => {
              const i = index++;
              return (
                <KitchenTicket
                  key={`${g.station ?? ""}:${t.id}`}
                  slug={slug}
                  ticket={t}
                  shortcutNumber={readOnly ? undefined : i < 9 ? i + 1 : undefined}
                  readOnly={readOnly}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
