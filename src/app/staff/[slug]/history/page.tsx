import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { getRecentOrders, HISTORY_DAYS } from "@/lib/bills";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  PREPARING: "bg-blue-50 text-blue-700",
  READY: "bg-pine-soft text-pine-deep",
  SERVED: "bg-paper text-muted",
  CANCELLED: "bg-danger-soft text-danger",
};

// Kitchen order history — the last HISTORY_DAYS of orders, grouped by table so
// staff can check what a table had before. Read-only.
export default async function HistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireStaffForSlug(slug);
  if (!session) redirect(`/staff/${slug}`);
  const { staff, restaurant } = session;

  if (!roleCan(staff.role, "bills:view")) {
    return (
      <main className="min-h-dvh bg-paper">
        <Header slug={slug} />
        <p className="max-w-3xl mx-auto px-5 py-6 text-sm text-muted">
          Your role doesn&apos;t include order history.
        </p>
      </main>
    );
  }

  const orders = await getRecentOrders(restaurant.id);
  const now = Date.now();

  // Group by table label, keeping each table's orders newest-first.
  const byTable = new Map<
    string,
    { id: string; orderNumber: number | null; status: string; createdAt: Date; source: string; note: string | null; items: { id: string; nameSnapshot: string; quantity: number }[] }[]
  >();
  for (const o of orders) {
    const label = o.bill.table?.label ?? "Counter";
    if (!byTable.has(label)) byTable.set(label, []);
    byTable.get(label)!.push({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt,
      source: o.source,
      note: o.note,
      items: o.items.map((it) => ({
        id: it.id,
        nameSnapshot: it.nameSnapshot,
        quantity: it.quantity,
      })),
    });
  }

  const tables = [...byTable.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true }),
  );

  return (
    <main className="min-h-dvh bg-paper">
      <Header slug={slug} />
      <div className="max-w-3xl mx-auto px-5 py-6">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Order history
          </h1>
          <p className="text-sm text-muted">Last {HISTORY_DAYS} days</p>
        </div>

        {tables.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
            <p className="text-muted">No orders in the last {HISTORY_DAYS} days.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {tables.map(([label, rows]) => (
              <section key={label}>
                <h2 className="text-sm font-medium text-muted mb-2">
                  Table {label}{" "}
                  <span className="text-xs">
                    ({rows.length} {rows.length === 1 ? "order" : "orders"})
                  </span>
                </h2>
                <div className="space-y-2">
                  {rows.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-[var(--radius-card)] border border-line bg-surface p-3.5"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted">
                          {o.orderNumber != null && (
                            <span className="font-medium text-ink-soft">
                              #{o.orderNumber}{" "}
                            </span>
                          )}
                          {timeAgo(now, o.createdAt)}
                          {o.source === "STAFF" ? " · staff" : ""}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            STATUS_STYLE[o.status] ?? "bg-paper text-muted"
                          }`}
                        >
                          {o.status.toLowerCase()}
                        </span>
                      </div>
                      <ul className="text-sm space-y-0.5">
                        {o.items.map((it) => (
                          <li key={it.id}>
                            <span className="tabular-nums font-medium">
                              {it.quantity}×
                            </span>{" "}
                            {it.nameSnapshot}
                          </li>
                        ))}
                      </ul>
                      {o.note && (
                        <p className="mt-1.5 text-xs text-amber-800">
                          Note: {o.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Header({ slug }: { slug: string }) {
  return (
    <header className="border-b border-line bg-surface px-5 py-4 sticky top-0 flex items-center gap-3">
      <Link
        href={`/staff/${slug}/home`}
        className="text-sm text-muted hover:text-ink"
      >
        ← Tables
      </Link>
      <span className="font-display text-lg font-semibold tracking-tight">
        History
      </span>
    </header>
  );
}

function timeAgo(now: number, when: Date): string {
  const mins = Math.floor((now - new Date(when).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
