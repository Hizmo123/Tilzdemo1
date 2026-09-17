import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getOrderTracking } from "@/lib/analytics";
import { parseRangeParams } from "@/lib/date-range";
import { AnalyticsTabs } from "@/components/dashboard/analytics-tabs";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { HourlyChart } from "@/components/dashboard/hourly-chart";

export default async function OrderAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant || !authz.can("bills:view")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Order tracking
        </h1>
        <p className="text-muted">
          {restaurant ? (
            "You don't have permission to view analytics."
          ) : (
            <>
              Create your restaurant first from the{" "}
              <Link href="/dashboard" className="text-pine hover:underline">
                Overview
              </Link>
              .
            </>
          )}
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const { preset, resolved } = parseRangeParams(sp, restaurant.timezone);
  const data = await getOrderTracking(restaurant.id, restaurant.timezone, resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Order tracking
        </h1>
        <p className="text-muted mt-1">Volume, source and timing of every order sent to the kitchen.</p>
      </div>

      <AnalyticsTabs active="/dashboard/analytics/orders" />
      <DateRangePicker value={preset} customFrom={sp.from} customTo={sp.to} />

      {data.totalOrders === 0 ? (
        <p className="text-muted">No orders in this period yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total orders" value={String(data.totalOrders)} />
            <StatCard
              label="Cancelled"
              value={`${data.byStatus.cancelled} (${data.cancelledPct.toFixed(1)}%)`}
            />
            <StatCard label="Avg. items / order" value={data.avgItemsPerOrder.toFixed(1)} />
            <StatCard
              label="Customer vs staff"
              value={`${data.bySource.customer} / ${data.bySource.staff}`}
            />
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
              Busiest times
            </h2>
            <p className="text-sm text-muted mb-4">Orders placed, by hour of day (venue local time).</p>
            <HourlyChart data={data.hourly} />
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 max-w-sm">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
              Ticket status
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Served</dt>
                <dd className="tabular-nums">{data.byStatus.served}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Cancelled</dt>
                <dd className="tabular-nums">{data.byStatus.cancelled}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Still active</dt>
                <dd className="tabular-nums">{data.byStatus.active}</dd>
              </div>
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
