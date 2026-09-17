import type { OrderStatusName } from "@/lib/bills";

type PassTicket = {
  id: string;
  orderNumber: number | null;
  tableLabel: string;
  status: OrderStatusName;
  isRefire: boolean;
  minutesAgo: number;
  byStation: [string, { name: string; quantity: number }[]][];
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  PREPARING: "bg-blue-50 text-blue-700",
  READY: "bg-pine-soft text-pine-deep",
};

// The expo/pass view: one card per order with every line regardless of
// station, grouped by station within the card, so whoever runs the pass can
// see everything a table is waiting on at a glance instead of hopping
// between station-filtered boards. Reuses the exact same order fetch as the
// board view — no separate query.
//
// Honest limitation, not hidden: a ticket's cook status (SUBMITTED /
// PREPARING / READY) is per ORDER, not per station-within-an-order — that's
// how the whole system already works (any station bumping the ticket moves
// the whole thing). For an order spanning multiple stations, this view
// labels it "mixed" so the pass knows to check with each station rather than
// trusting a single status to mean everything's actually ready.
export function PassView({ tickets }: { tickets: PassTicket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
        <p className="text-muted">No active orders. New tickets appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {tickets.map((t) => {
        const mixed = t.byStation.length > 1;
        const ageBorder =
          t.minutesAgo >= 10
            ? "border-l-4 border-l-danger"
            : t.minutesAgo >= 5
              ? "border-l-4 border-l-amber-500"
              : "border-l-4 border-l-pine";
        return (
          <div
            key={t.id}
            className={`rounded-[var(--radius-card)] border border-line ${ageBorder} bg-surface p-4`}
          >
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="font-display text-lg font-semibold tracking-tight">
                {t.orderNumber != null && <span className="text-muted">#{t.orderNumber} · </span>}
                {t.tableLabel}
              </span>
              <div className="flex items-center gap-1.5">
                {t.isRefire && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-danger-soft text-danger font-semibold">
                    ↻ Re-fire
                  </span>
                )}
                <span
                  className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    STATUS_STYLE[t.status] ?? "bg-paper text-muted"
                  }`}
                >
                  {t.status.toLowerCase()}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted mb-3">
              {t.minutesAgo === 0 ? "just now" : `${t.minutesAgo} min ago`}
              {mixed && <span className="text-amber-700"> · spans {t.byStation.length} stations</span>}
            </p>

            <div className="space-y-2.5">
              {t.byStation.map(([station, items]) => (
                <div key={station}>
                  <p className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">
                    {station}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((it, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium tabular-nums">{it.quantity}×</span> {it.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
