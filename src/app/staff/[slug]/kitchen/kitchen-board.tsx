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
export function KitchenBoard({
  slug,
  tickets,
  // Connect-tier orgs: see kitchen-ticket.tsx's matching comment. Disables
  // the numeric bump shortcut too, not just the on-card buttons — the same
  // "does nothing real" rule applies to it.
  readOnly = false,
}: {
  slug: string;
  tickets: Ticket[];
  readOnly?: boolean;
}) {
  const router = useRouter();

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

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {tickets.map((t, i) => (
        <KitchenTicket
          key={t.id}
          slug={slug}
          ticket={t}
          shortcutNumber={readOnly ? undefined : i < 9 ? i + 1 : undefined}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
