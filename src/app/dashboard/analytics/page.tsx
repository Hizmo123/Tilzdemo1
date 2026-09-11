import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics";
import { formatCents } from "@/lib/money";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </p>
    </div>
  );
}

export default async function AnalyticsPage() {
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
  const data = await getAnalytics(restaurant.id, restaurant.timezone);

  if (data.empty) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Analytics
        </h1>
        <p className="text-muted">
          No data yet. Once you take orders and payments, your numbers appear here.
        </p>
      </div>
    );
  }

  const maxCents = Math.max(1, ...data.series.map((s) => s.cents));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Analytics
        </h1>
        <p className="text-muted mt-1">Based on your paid bills.</p>
      </div>

      <div className="flex gap-2 text-sm">
        <span className="rounded-lg bg-ink text-surface px-3 py-1.5">Overview</span>
        <Link
          href="/dashboard/analytics/products"
          className="rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
        >
          Products
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Sales today" value={formatCents(data.salesTodayCents, currency)} />
        <Stat label="Paid today" value={String(data.ordersToday)} />
        <Stat label="Avg. order" value={formatCents(data.avgOrderCents, currency)} />
        <Stat label="Tips today" value={formatCents(data.tipsTodayCents, currency)} />
      </div>

      {/* 7-day revenue bar chart (pure CSS, no dependency) */}
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
          Last 7 days
        </h2>
        <div className="flex items-end justify-between gap-2 h-40">
          {data.series.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[10px] text-muted mb-1 tabular-nums">
                {s.cents > 0 ? formatCents(s.cents, currency).replace(/\.00$/, "") : ""}
              </span>
              <div
                className="w-full rounded-t bg-pine"
                style={{ height: `${Math.max(2, (s.cents / maxCents) * 100)}%` }}
              />
              <span className="text-xs text-muted mt-2">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
            Top items
          </h2>
          {data.topItems.length === 0 ? (
            <p className="text-sm text-muted">No items sold yet.</p>
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
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
            All time
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Bills paid</dt>
              <dd className="tabular-nums">{data.allPaidCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Total sales</dt>
              <dd className="tabular-nums">{formatCents(data.allSalesCents, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Total tips</dt>
              <dd className="tabular-nums">{formatCents(data.allTipsCents, currency)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
