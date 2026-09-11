import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveLocation, getTenantContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { startOfTodayInTz } from "@/lib/time";
import { countOpenRequests } from "@/lib/requests";
import { CreateRestaurantForm } from "./create-restaurant-form";
import { LiveRefresh } from "./live-refresh";
import { LoadSampleButton } from "./sample/load-sample-button";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </p>
    </div>
  );
}

export default async function DashboardHome() {
  // Brand-new account with no venue yet → run the setup wizard.
  const { membership } = await getTenantContext();
  if (!membership) redirect("/onboarding");

  const ctx = await getActiveLocation();

  // Edge case: has an org but somehow no restaurant/location yet.
  if (!ctx) {
    return (
      <div className="max-w-lg">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Welcome
        </h1>
        <p className="text-muted mb-6">
          Let&apos;s set up your restaurant and first location to get started.
        </p>
        <CreateRestaurantForm />
      </div>
    );
  }

  const { restaurant, location } = ctx;
  const currency = restaurant.currency;

  const tableIds = (
    await prisma.table.findMany({
      where: { locationId: location.id },
      select: { id: true },
    })
  ).map((t) => t.id);

  // "Today" resets at the restaurant's local midnight, not the server's.
  const startOfToday = startOfTodayInTz(restaurant.timezone);

  const [paidToday, openBills, paidTablesCount, tables, openRequests] =
    await Promise.all([
      prisma.bill.aggregate({
        where: {
          tableId: { in: tableIds },
          status: "PAID",
          paidAt: { gte: startOfToday },
        },
        _sum: { totalCents: true },
        _count: true,
      }),
      prisma.bill.count({
        where: { tableId: { in: tableIds }, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
      }),
      prisma.bill.count({
        where: {
          tableId: { in: tableIds },
          status: "PAID",
          paidAt: { gte: startOfToday },
        },
      }),
      prisma.table.findMany({
        where: { locationId: location.id },
        orderBy: [{ section: "asc" }, { createdAt: "asc" }],
        include: {
          bills: {
            where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      countOpenRequests(restaurant.id),
    ]);

  const salesToday = paidToday._sum.totalCents ?? 0;
  const ordersToday = paidToday._count;

  return (
    <div className="space-y-8">
      <LiveRefresh />
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {restaurant.name}
        </h1>
        <p className="text-muted mt-1">
          {location.name} · {currency} · {restaurant.timezone}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Today's sales" value={formatCents(salesToday, currency)} />
        <StatCard label="Paid today" value={String(ordersToday)} />
        <StatCard label="Open tables" value={String(openBills)} />
        <StatCard
          label={openRequests > 0 ? "Open requests" : "Paid tables"}
          value={String(openRequests > 0 ? openRequests : paidTablesCount)}
        />
      </div>

      {tables.length === 0 && <LoadSampleButton />}

      {ctx.membership.organization.plan === "FREE" && (
        <div className="rounded-[var(--radius-card)] border border-pine/30 bg-pine-soft p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-pine-deep">You&apos;re on the free Starter plan</p>
            <p className="text-sm text-pine-deep/80">
              Upgrade to Venue to take live payments across your tables.
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="rounded-lg bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep"
          >
            See plans
          </Link>
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Live tables
        </h2>
        {tables.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
            <p className="text-muted">
              No tables yet.{" "}
              <Link href="/dashboard/tables" className="text-pine hover:underline">
                Add your first table
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tables.map((t) => {
              const bill = t.bills[0];
              const openAmount = bill
                ? bill.totalCents - bill.amountPaidCents
                : 0;
              return (
                <Link
                  key={t.id}
                  href={`/dashboard/tables/${t.id}`}
                  className="rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:border-pine/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-semibold tracking-tight">
                      {t.label}
                    </span>
                    {!t.active ? (
                      <span className="text-[10px] uppercase tracking-wide text-muted">
                        Off
                      </span>
                    ) : bill ? (
                      <span className="text-[10px] uppercase tracking-wide text-amber-700">
                        Open
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-muted/60">
                        Empty
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted mt-2 tabular-nums">
                    {bill ? formatCents(openAmount, currency) : "—"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
