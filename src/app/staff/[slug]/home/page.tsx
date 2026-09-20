import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth";
import { roleCan, ROLE_META } from "@/lib/rbac";
import { formatCents } from "@/lib/money";
import { getOpenRequests } from "@/lib/requests";
import { getReadyOrders } from "@/lib/bills";
import { LiveRefresh } from "@/app/dashboard/live-refresh";
import { staffSignOut } from "./actions";
import { RequestsBanner } from "./requests-banner";
import { ReadyBanner } from "./ready-banner";

export const dynamic = "force-dynamic";

// Unpaid-bill safety net: a table whose bill still has a balance owing and
// hasn't had a new order in this long gets flagged on the floor view, purely
// as a notification for staff to go check on it. Deliberately NOT an
// auto-charge, auto-close, or anything that touches the bill itself —
// server-computed from timestamps already on Bill/Order every time this page
// loads, so it needs no background job or scheduler to exist.
const UNPAID_ALERT_MINUTES = 20;

export default async function StaffHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getStaffSession();
  if (!session || session.restaurant.slug !== slug) redirect(`/staff/${slug}`);

  const { staff, restaurant } = session;
  const currency = restaurant.currency;
  const canSeeBills = roleCan(staff.role, "bills:view");

  // Filtering through the table -> location -> restaurant relation directly
  // (rather than pre-fetching location ids first) turns two sequential round
  // trips into one query, which now also runs alongside the requests fetch.
  const tablesQuery = prisma.table.findMany({
    where: { location: { restaurantId: restaurant.id }, active: true },
    orderBy: [{ section: "asc" }, { createdAt: "asc" }],
    include: {
      bills: {
        where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          _count: { select: { items: true } },
          orders: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });
  const [tables, openRequestRows, readyOrderRows] = await Promise.all([
    canSeeBills ? tablesQuery : Promise.resolve([] as Awaited<typeof tablesQuery>),
    getOpenRequests(restaurant.id),
    roleCan(staff.role, "kitchen:manage") ? getReadyOrders(restaurant.id) : Promise.resolve([]),
  ]);
  const readyOrders = readyOrderRows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    tableLabel: o.bill.table?.label ?? "Counter",
  }));

  const now = Date.now();
  const openRequests = openRequestRows.map((r) => ({
    id: r.id,
    tableLabel: r.table.label,
    status: r.status,
    minutesAgo: Math.floor((now - new Date(r.createdAt).getTime()) / 60000),
  }));
  const assistanceTableIds = new Set(openRequestRows.map((r) => r.tableId));

  // Group tables by section for a readable floor.
  const groups = new Map<string, typeof tables>();
  for (const t of tables) {
    const key = t.section ?? "Tables";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const openCount = tables.filter((t) => t.bills.length > 0).length;

  return (
    <main className="min-h-dvh bg-paper">
      <LiveRefresh seconds={5} restaurantId={restaurant.id} />
      <header className="border-b border-line bg-surface px-5 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight">
            {restaurant.name}
          </p>
          <p className="text-xs text-muted">
            {staff.name} · {ROLE_META[staff.role].label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {roleCan(staff.role, "orders:manage") && (
            <Link
              href={`/staff/${slug}/counter`}
              className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
            >
              Counter
            </Link>
          )}
          {roleCan(staff.role, "orders:manage") && (
            <Link
              href={`/staff/${slug}/register`}
              className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
            >
              Register
            </Link>
          )}
          {roleCan(staff.role, "kitchen:manage") && (
            <Link
              href={`/staff/${slug}/kitchen`}
              className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
            >
              Kitchen
            </Link>
          )}
          {roleCan(staff.role, "menu:availability") && (
            <Link
              href={`/staff/${slug}/menu`}
              className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
            >
              Menu
            </Link>
          )}
          {roleCan(staff.role, "bills:view") && (
            <Link
              href={`/staff/${slug}/history`}
              className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
            >
              History
            </Link>
          )}
          <form action={staffSignOut.bind(null, slug)}>
            <button type="submit" className="text-sm text-ink-soft hover:text-danger ml-1">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
        <ReadyBanner slug={slug} orders={readyOrders} />
        <RequestsBanner slug={slug} requests={openRequests} />

        <div className="flex items-baseline justify-between mb-4">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Floor
          </h1>
          <p className="text-sm text-muted">
            {openCount} open · {tables.length} tables
          </p>
        </div>

        {!canSeeBills ? (
          <p className="text-sm text-muted">
            Your role doesn&apos;t include table access.
          </p>
        ) : tables.length === 0 ? (
          <p className="text-sm text-muted">No active tables.</p>
        ) : (
          <div className="space-y-6">
            {[...groups.entries()].map(([section, rows]) => (
              <section key={section}>
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted mb-2">
                  {section}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {rows.map((t) => {
                    const bill = t.bills[0];
                    const remaining = bill ? bill.totalCents - bill.amountPaidCents : 0;
                    const needsHelp = assistanceTableIds.has(t.id);
                    const itemCount = bill?._count?.items ?? 0;

                    // Last order time (falls back to when the bill itself was
                    // opened if it somehow has no orders yet) — the clock this
                    // safety net runs off, never the customer's own device.
                    const lastActivityAt = bill?.orders[0]?.createdAt ?? bill?.createdAt;
                    const minutesSinceActivity = lastActivityAt
                      ? Math.floor((now - new Date(lastActivityAt).getTime()) / 60000)
                      : 0;
                    const unpaidTooLong =
                      !!bill && remaining > 0 && minutesSinceActivity >= UNPAID_ALERT_MINUTES;

                    // Priority: assistance > unpaid-too-long > open > empty.
                    const cls = needsHelp
                      ? "border-amber-300 bg-amber-50 hover:border-amber-400"
                      : unpaidTooLong
                        ? "border-danger/40 bg-danger-soft hover:border-danger/60"
                        : bill
                          ? "border-pine/30 bg-pine-soft/40 hover:border-pine/50"
                          : "border-line bg-surface hover:border-line";

                    return (
                      <Link
                        key={t.id}
                        href={`/staff/${slug}/table/${t.id}`}
                        className={`rounded-[var(--radius-card)] border p-4 transition-colors flex flex-col justify-between min-h-[104px] ${cls}`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-display text-2xl font-semibold tracking-tight leading-none">
                            {t.label}
                          </span>
                          {needsHelp ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                              Help
                            </span>
                          ) : unpaidTooLong ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-danger">
                              Unpaid
                            </span>
                          ) : bill ? (
                            <span className="text-[10px] uppercase tracking-wide text-pine-deep">
                              {bill.status === "PARTIALLY_PAID" ? "Part-paid" : "Open"}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wide text-muted/50">
                              Empty
                            </span>
                          )}
                        </div>

                        <div className="mt-3">
                          {needsHelp && (
                            <p className="text-xs font-medium text-amber-700 mb-1">
                              ● Needs assistance
                            </p>
                          )}
                          {!needsHelp && unpaidTooLong && (
                            <p className="text-xs font-medium text-danger mb-1">
                              ● Unpaid {minutesSinceActivity}m
                            </p>
                          )}
                          {bill ? (
                            <p className="text-sm tabular-nums">
                              <span className="font-semibold">
                                {formatCents(remaining, currency)}
                              </span>
                              {itemCount > 0 && (
                                <span className="text-muted">
                                  {" · "}
                                  {itemCount} {itemCount === 1 ? "item" : "items"}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-sm text-muted/50">—</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
