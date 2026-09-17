import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getRevenueOverview } from "@/lib/analytics";
import { parseRangeParams } from "@/lib/date-range";
import { formatCents } from "@/lib/money";
import { AnalyticsTabs } from "@/components/dashboard/analytics-tabs";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueBarChart } from "@/components/dashboard/bar-chart";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Analytics
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

  if (!authz.can("bills:view")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Analytics
        </h1>
        <p className="text-muted">You don&apos;t have permission to view analytics.</p>
      </div>
    );
  }

  const currency = restaurant.currency;
  const sp = await searchParams;
  const { preset, resolved } = parseRangeParams(sp, restaurant.timezone);
  const data = await getRevenueOverview(restaurant.id, restaurant.timezone, resolved);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Analytics
        </h1>
        <p className="text-muted mt-1">Based on your paid bills.</p>
      </div>

      <AnalyticsTabs active="/dashboard/analytics" />

      {data.empty ? (
        <p className="text-muted">
          No data yet. Once you take orders and payments, your numbers appear here.
        </p>
      ) : (
        <>
          <DateRangePicker value={preset} customFrom={sp.from} customTo={sp.to} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={`Revenue · ${resolved.label}`}
              value={formatCents(data.totalRevenueCents, currency)}
              changePct={data.revenueChangePct}
            />
            <StatCard
              label="Paid orders"
              value={String(data.orderCount)}
              changePct={data.orderCountChangePct}
            />
            <StatCard label="Avg. order" value={formatCents(data.avgOrderCents, currency)} />
            <StatCard label="Tips" value={formatCents(data.tipsCents, currency)} />
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
              Revenue — {resolved.label}
            </h2>
            <RevenueBarChart data={data.series} currency={currency} />
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
              Top items
            </h2>
            {data.topItems.length === 0 ? (
              <p className="text-sm text-muted">No items sold in this period.</p>
            ) : (
              <ul className="space-y-2">
                {data.topItems.map((t) => (
                  <li key={t.name} className="flex justify-between text-sm">
                    <span>
                      <span className="text-muted tabular-nums">{t.qty}×</span> {t.name}
                    </span>
                    <span className="tabular-nums text-muted">
                      {formatCents(t.revenueCents, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/dashboard/analytics/products"
              className="inline-block text-sm text-pine hover:underline mt-4"
            >
              Full product breakdown →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
