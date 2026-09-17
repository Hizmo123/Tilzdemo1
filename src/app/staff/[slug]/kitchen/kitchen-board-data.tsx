import Link from "next/link";
import {
  getKitchenOrders,
  getPendingApprovals,
  getRecentlyServed,
  type OrderStatusName,
} from "@/lib/bills";
import { KitchenLive } from "./kitchen-live";
import { StationTabs } from "./station-tabs";
import { KitchenBoard } from "./kitchen-board";
import { ApprovalCard } from "./approval-card";
import { RecentlyServedRow } from "./recently-served-row";
import { PassView } from "./pass-view";

// Everything on this page that actually depends on the kitchen data fetch —
// split out of page.tsx so a Suspense boundary there can stream the (fast,
// data-independent) header immediately and show a board skeleton while these
// three queries are in flight, instead of a blank screen for the whole
// request. The queries themselves aren't any faster; the perceived load is.
export async function KitchenBoardData({
  slug,
  restaurantId,
  staffApproval,
  paymentTiming,
  kitchenChime,
  lockedStation,
  stationFilter,
  view,
}: {
  slug: string;
  restaurantId: string;
  staffApproval: boolean;
  paymentTiming: string;
  kitchenChime: boolean;
  lockedStation: string | null;
  stationFilter?: string;
  view?: string;
}) {
  const prepay = paymentTiming === "before";
  const passView = !lockedStation && view === "pass";
  const [orders, pendings, served] = await Promise.all([
    getKitchenOrders(restaurantId),
    staffApproval ? getPendingApprovals(restaurantId) : Promise.resolve([]),
    getRecentlyServed(restaurantId),
  ]);
  const now = Date.now();

  // Distinct stations across active tickets (owner sets these per menu category).
  const stationSet = new Set<string>();
  for (const o of orders)
    for (const it of o.items) if (it.station) stationSet.add(it.station);
  const stations = [...stationSet].sort();
  const active = lockedStation ?? (stationFilter && stations.includes(stationFilter) ? stationFilter : null);

  const label = (o: { bill: { table: { label: string } } }) => `Table ${o.bill.table.label}`;

  // Board view: filtered to the active station (or everything), one card per
  // ticket, items trimmed to what this screen cares about.
  const tickets = orders
    .map((o) => {
      const items = o.items
        .filter((it) => !active || it.station === active)
        .map((it) => ({
          id: it.id,
          menuItemId: it.menuItemId,
          name: it.nameSnapshot,
          quantity: it.quantity,
          allergens: it.menuItem?.allergens ?? [],
          available: it.menuItem?.available ?? true,
          note: it.note,
        }));
      return { o, items };
    })
    .filter((t) => t.items.length > 0)
    .map(({ o, items }) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      tableLabel: label(o),
      billId: o.bill.id,
      status: o.status as OrderStatusName,
      source: o.source,
      isRefire: o.isRefire,
      note: o.note,
      prepay,
      billPaid: o.bill.totalCents - o.bill.amountPaidCents <= 0,
      minutesAgo: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
      items,
    }));

  // Pass/expo view: unfiltered by station — every active order, every line,
  // grouped by station within the card. Reuses the same `orders` fetch.
  const passTickets = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    tableLabel: label(o),
    status: o.status as OrderStatusName,
    isRefire: o.isRefire,
    minutesAgo: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
    byStation: Object.entries(
      o.items.reduce<Record<string, { name: string; quantity: number }[]>>((acc, it) => {
        const key = it.station ?? "Kitchen";
        (acc[key] ??= []).push({ name: it.nameSnapshot, quantity: it.quantity });
        return acc;
      }, {}),
    ).sort(([a], [b]) => a.localeCompare(b)),
  }));

  // "All-day" — total of each item across the visible tickets, so the line can
  // batch (e.g. "12× Flat White").
  const allDay = new Map<string, number>();
  for (const t of tickets)
    for (const it of t.items)
      allDay.set(it.name, (allDay.get(it.name) ?? 0) + it.quantity);
  const allDayList = [...allDay.entries()].sort((a, b) => b[1] - a[1]);

  // A station-locked device only sees its own station's approvals/history —
  // an unlocked screen with a station tab selected still sees every pending
  // approval regardless (accepting an order isn't station-specific work), so
  // this trim only ever applies when `lockedStation` is set.
  const pendingCards = pendings
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      tableLabel: label(o),
      note: o.note,
      minutesAgo: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
      items: o.items
        .filter((it) => !lockedStation || it.station === lockedStation)
        .map((it) => ({
          id: it.id,
          name: it.nameSnapshot,
          quantity: it.quantity,
          note: it.note,
        })),
    }))
    .filter((p) => !lockedStation || p.items.length > 0);

  const servedRows = served
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      tableLabel: label(o),
      items: o.items
        .filter((it) => !lockedStation || it.station === lockedStation)
        .map((it) => ({ id: it.id, name: it.nameSnapshot, quantity: it.quantity })),
    }))
    .filter((s) => !lockedStation || s.items.length > 0);

  const ticketIds = [...pendingCards.map((p) => p.id), ...tickets.map((t) => t.id)];

  return (
    <>
      <KitchenLive
        ticketIds={ticketIds}
        restaurantId={restaurantId}
        seconds={4}
        chimeEnabled={kitchenChime}
      />

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
        {/* Board / Pass toggle — a station-locked device skips this entirely:
            Pass is deliberately cross-station, and the station is fixed, not
            a tab to switch. The station name is already in the header title
            (see KitchenHeader), so there's nothing left to show here. */}
        {!lockedStation && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex rounded-lg border border-line p-0.5">
              <Link
                href={`/staff/${slug}/kitchen${active ? `?station=${encodeURIComponent(active)}` : ""}`}
                className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
                  !passView ? "bg-pine text-[color:var(--on-accent,#fff)]" : "text-muted hover:text-ink"
                }`}
              >
                Board
              </Link>
              <Link
                href={`/staff/${slug}/kitchen?view=pass`}
                className={`px-3.5 py-1.5 text-sm rounded-md transition-colors ${
                  passView ? "bg-pine text-[color:var(--on-accent,#fff)]" : "text-muted hover:text-ink"
                }`}
              >
                Pass
              </Link>
            </div>

            {!passView && stations.length > 0 && (
              <StationTabs slug={slug} stations={stations} active={active} />
            )}
          </div>
        )}

        {passView ? (
          <PassView tickets={passTickets} />
        ) : (
          <>
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
              <KitchenBoard slug={slug} tickets={tickets} />
            )}

            {/* Recall / re-fire recently-served */}
            {servedRows.length > 0 && (
              <section>
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted mb-2">
                  Recently served
                </h2>
                <div className="space-y-1.5">
                  {servedRows.map((o) => (
                    <RecentlyServedRow key={o.id} slug={slug} order={o} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
