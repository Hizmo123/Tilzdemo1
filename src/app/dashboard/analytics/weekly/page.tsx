import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { getWeeklyReport } from "@/lib/weekly-report";
import { formatCents } from "@/lib/money";
import { AnalyticsTabs } from "@/components/dashboard/analytics-tabs";
import { RevenueBarChart } from "@/components/dashboard/bar-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { PrintButton } from "@/components/receipt/print-button";
import { HistoryWindowNote } from "@/components/dashboard/history-window-note";

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Weekly report
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
          Weekly report
        </h1>
        <p className="text-muted">You don&apos;t have permission to view this.</p>
      </div>
    );
  }

  const { week } = await searchParams;
  const requestedOffset = Number.isFinite(Number(week)) ? Math.trunc(Number(week)) : 0;

  // No date-range picker here — navigation is by whole week (weekOffset),
  // so the plan's day-based history window (entitlements.analyticsWindowDays)
  // is translated into a minimum (most-negative) weekOffset instead of a
  // clamped `from` date. Weeks are ~7 days, so this is an approximation,
  // not an exact day cutoff.
  const entitlements = await getEntitlements(restaurant.organizationId);
  const minOffset =
    entitlements.analyticsWindowDays === null
      ? -Infinity
      : -Math.floor((entitlements.analyticsWindowDays - 1) / 7);
  const weekOffset = Math.max(requestedOffset, minOffset);
  const clamped = requestedOffset < minOffset;

  const currency = restaurant.currency;
  const data = await getWeeklyReport(restaurant.id, restaurant.timezone, weekOffset);

  const rangeLabel = `${data.weekStart.toLocaleDateString("en-AU", {
    timeZone: restaurant.timezone,
    day: "numeric",
    month: "short",
  })} – ${new Date(data.weekEnd.getTime() - 86_400_000).toLocaleDateString("en-AU", {
    timeZone: restaurant.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3 print:block">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Weekly revenue report
          </h1>
          <p className="text-muted mt-1">
            {restaurant.name} · Week {data.isoWeek}, {data.isoYear} · {rangeLabel}
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton label="Print / Save PDF" />
        </div>
      </div>

      <div className="print:hidden">
        <AnalyticsTabs active="/dashboard/analytics/weekly" />
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2 print:hidden">
        {weekOffset > minOffset ? (
          <Link
            href={`/dashboard/analytics/weekly?week=${weekOffset - 1}`}
            className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-ink/30"
          >
            ← Previous week
          </Link>
        ) : (
          <span className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted/50 cursor-not-allowed">
            ← Previous week
          </span>
        )}
        {!isCurrentWeek && (
          <Link
            href="/dashboard/analytics/weekly"
            className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-ink/30"
          >
            This week
          </Link>
        )}
        <Link
          href={`/dashboard/analytics/weekly?week=${weekOffset + 1}`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-ink/30"
        >
          Next week →
        </Link>
      </div>

      {clamped && <HistoryWindowNote />}

      {data.orderCount === 0 ? (
        <p className="text-muted">No paid bills in this week.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total revenue"
              value={formatCents(data.totalRevenueCents, currency)}
              changePct={data.revenueChangePct}
            />
            <StatCard label="Paid orders" value={String(data.orderCount)} />
            <StatCard label="Avg. order" value={formatCents(data.avgOrderCents, currency)} />
            <StatCard label="Tips" value={formatCents(data.tipsCents, currency)} />
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
              Revenue by day
            </h2>
            <RevenueBarChart data={data.byDay} currency={currency} />
          </div>

        </>
      )}
    </div>
  );
}
