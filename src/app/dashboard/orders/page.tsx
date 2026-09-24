import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { getKitchenOrders, getOrderHistory, type OrderStatusName } from "@/lib/bills";
import { formatCents } from "@/lib/money";
import {
  parseRangeParams,
  clampRangeToWindow,
  disabledPresets,
  earliestAllowedDateStr,
} from "@/lib/date-range";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { HistoryWindowNote } from "@/components/dashboard/history-window-note";
import { LiveRefresh } from "../live-refresh";
import { DashboardTicket } from "./dashboard-ticket";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const authz = await getAuthz();

  if (!authz.membership) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Orders
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  if (!authz.can("kitchen:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Orders
        </h1>
        <p className="text-muted">You don&apos;t have permission to view orders.</p>
      </div>
    );
  }

  const restaurant = authz.membership.organization.restaurants[0];
  const sp = await searchParams;
  const ent = restaurant ? await getEntitlements(authz.membership.organizationId) : null;

  // Same pattern Analytics uses for entitlements.analyticsWindowDays:
  // resolve the requested preset/custom range, then clamp it to the plan's
  // history window (null = unrestricted). Order History defaults to "Last
  // 30 days" rather than Analytics' own "7d" default.
  const { preset, resolved: requestedRange } = restaurant
    ? parseRangeParams(sp, restaurant.timezone, "30d")
    : { preset: "30d" as const, resolved: { from: new Date(), to: new Date(), label: "" } };
  const { resolved: historyRange, clamped } = restaurant
    ? clampRangeToWindow(requestedRange, ent?.analyticsWindowDays ?? null, restaurant.timezone)
    : { resolved: requestedRange, clamped: false };

  const [orders, history] = restaurant
    ? await Promise.all([
        getKitchenOrders(restaurant.id),
        getOrderHistory(restaurant.id, historyRange),
      ])
    : [[], []];
  const now = Date.now();
  const currency = restaurant?.currency ?? "AUD";
  // Square owns the kitchen on Connect — no local status-changing control
  // here (see dashboard-ticket.tsx); the fulfillment-sync webhook is the
  // only thing that moves these tickets forward.
  const readOnly = ent?.requiresSquare ?? false;

  const tickets = orders.map((o) => ({
    id: o.id,
    tableLabel: o.bill.table?.label ?? "Counter",
    status: o.status as OrderStatusName,
    source: o.source,
    minutesAgo: Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
    items: o.items.map((it) => ({
      id: it.id,
      name: it.nameSnapshot,
      quantity: it.quantity,
      note: it.note,
    })),
  }));

  return (
    <div className="space-y-8">
      <LiveRefresh restaurantId={restaurant?.id ?? null} />
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Orders
        </h1>
        <p className="text-muted mt-1">
          Active kitchen tickets ({tickets.length}). Staff can also work these
          from the kitchen terminal.
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-muted">No active orders right now.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tickets.map((t) => (
            <DashboardTicket key={t.id} ticket={t} readOnly={readOnly} />
          ))}
        </div>
      )}

      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight mb-1">
          History
        </h2>
        <p className="text-muted mb-4">
          {historyRange.label} · {history.length} served order
          {history.length === 1 ? "" : "s"}.
        </p>

        {restaurant && (
          <div className="mb-4 space-y-2">
            <DateRangePicker
              value={preset}
              customFrom={sp.from}
              customTo={sp.to}
              disabledPresets={disabledPresets(ent?.analyticsWindowDays ?? null, restaurant.timezone)}
              minCustomDate={earliestAllowedDateStr(ent?.analyticsWindowDays ?? null, restaurant.timezone) ?? undefined}
            />
            {clamped && <HistoryWindowNote />}
          </div>
        )}

        {history.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
            <p className="text-muted">No served orders yet.</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface divide-y divide-line overflow-hidden">
            {history.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {o.tableLabel}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {o.items.map((it) => `${it.quantity}× ${it.name}`).join(", ")}
                    </span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {(o.servedAt ?? o.createdAt).toLocaleString("en-AU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="tabular-nums text-sm font-medium">
                    {formatCents(o.totalCents, currency)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide bg-paper text-muted px-1.5 py-0.5 rounded">
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
