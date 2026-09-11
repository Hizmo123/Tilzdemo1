import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import {
  getKitchenOrders,
  getPendingApprovals,
  getRecentlyServed,
  type OrderStatusName,
} from "@/lib/bills";
import { KitchenLive } from "./kitchen-live";
import { KitchenTicket } from "./kitchen-ticket";
import { ApprovalCard } from "./approval-card";
import { RecallButton } from "./recall-button";

export const dynamic = "force-dynamic";

export default async function KitchenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ station?: string }>;
}) {
  const { slug } = await params;
  const { station: stationFilter } = await searchParams;

  const session = await requireStaffForSlug(slug);
  if (!session) redirect(`/staff/${slug}`);

  const { staff, restaurant } = session;

  if (!roleCan(staff.role, "kitchen:manage")) {
    return (
      <main className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface px-5 py-4 flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Kitchen</span>
        </header>
        <p className="max-w-3xl mx-auto px-5 py-6 text-sm text-muted">
          Your role doesn&apos;t include kitchen access.
        </p>
      </main>
    );
  }

  const prepay = restaurant.paymentTiming === "before";
  const [orders, pendings, served] = await Promise.all([
    getKitchenOrders(restaurant.id),
    restaurant.staffApproval
      ? getPendingApprovals(restaurant.id)
      : Promise.resolve([]),
    getRecentlyServed(restaurant.id),
  ]);
  const now = Date.now();

  // Distinct stations across active tickets (owner sets these per menu category).
  const stationSet = new Set<string>();
  for (const o of orders)
    for (const it of o.items) if (it.station) stationSet.add(it.station);
  const stations = [...stationSet].sort();
  const active = stationFilter && stations.includes(stationFilter) ? stationFilter : null;

  const label = (o: (typeof orders)[number]) =>
    o.bill.isTakeaway
      ? `Pickup · ${o.bill.customerName ?? "—"}`
      : `Table ${o.bill.table.label}`;

  const tickets = orders
    .map((o) => {
      // When a station is selected, show only that station's items; drop the
      // ticket if it has nothing for this station.
      const items = o.items
        .filter((it) => !active || it.station === active)
        .map((it) => ({ id: it.id, name: it.nameSnapshot, quantity: it.quantity }));
      return { o, items };
    })
    .filter((t) => t.items.length > 0)
    .map(({ o, items }) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      tableLabel: label(o),
      isTakeaway: o.bill.isTakeaway,
      billId: o.bill.id,
      status: o.status as OrderStatusName,
      source: o.source,
      note: o.note,
      prepay,
      billPaid: o.bill.totalCents - o.bill.amountPaidCents <= 0,
      minutesAgo: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
      items,
    }));

  // "All-day" — total of each item across the visible tickets, so the line can
  // batch (e.g. "12× Flat White").
  const allDay = new Map<string, number>();
  for (const t of tickets)
    for (const it of t.items)
      allDay.set(it.name, (allDay.get(it.name) ?? 0) + it.quantity);
  const allDayList = [...allDay.entries()].sort((a, b) => b[1] - a[1]);

  const pendingCards = pendings.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    tableLabel: label(o),
    note: o.note,
    minutesAgo: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
    items: o.items.map((it) => ({
      id: it.id,
      name: it.nameSnapshot,
      quantity: it.quantity,
    })),
  }));

  const ticketIds = [...pendingCards.map((p) => p.id), ...tickets.map((t) => t.id)];

  const tabClass = (on: boolean) =>
    `text-sm rounded-lg px-3 py-1 transition-colors ${
      on ? "bg-pine text-[color:var(--on-accent,#fff)]" : "border border-line hover:border-ink/30"
    }`;

  return (
    <main className="min-h-dvh bg-paper">
      <KitchenLive ticketIds={ticketIds} seconds={4} />
      <header className="border-b border-line bg-surface px-5 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Kitchen</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/staff/${slug}/history`}
            className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
          >
            History
          </Link>
          <span className="text-xs text-muted hidden sm:inline">
            {tickets.length} active · {staff.name}
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
        {/* Station filter */}
        {stations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/staff/${slug}/kitchen`} className={tabClass(!active)}>
              All
            </Link>
            {stations.map((s) => (
              <Link
                key={s}
                href={`/staff/${slug}/kitchen?station=${encodeURIComponent(s)}`}
                className={tabClass(active === s)}
              >
                {s}
              </Link>
            ))}
          </div>
        )}

        {/* All-day counts */}
        {allDayList.length > 0 && (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3 text-sm">
            <span className="text-muted font-medium mr-2">All day:</span>
            {allDayList.map(([name, qty], i) => (
              <span key={name} className="tabular-nums">
                {i > 0 && <span className="text-muted"> · </span>}
                {qty}× {name}
              </span>
            ))}
          </div>
        )}

        {pendingCards.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-amber-700 mb-2">
              Awaiting approval ({pendingCards.length})
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {pendingCards.map((p) => (
                <ApprovalCard key={p.id} slug={slug} order={p} />
              ))}
            </div>
          </section>
        )}

        {tickets.length === 0 ? (
          pendingCards.length === 0 && (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
              <p className="text-muted">No active orders. New tickets appear here.</p>
            </div>
          )
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {tickets.map((t) => (
              <KitchenTicket key={t.id} slug={slug} ticket={t} />
            ))}
          </div>
        )}

        {/* Recall recently-served */}
        {served.length > 0 && (
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted mb-2">
              Recently served
            </h2>
            <div className="space-y-1.5">
              {served.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2"
                >
                  <span className="text-sm text-muted truncate">
                    {o.orderNumber != null && (
                      <span className="font-medium text-ink-soft">#{o.orderNumber} </span>
                    )}
                    {o.bill.isTakeaway
                      ? o.bill.customerName ?? "Pickup"
                      : `Table ${o.bill.table.label}`}{" "}
                    · {o.items.map((it) => `${it.quantity}× ${it.nameSnapshot}`).join(", ")}
                  </span>
                  <RecallButton slug={slug} orderId={o.id} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
