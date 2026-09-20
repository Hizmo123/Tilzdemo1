import Link from "next/link";
import { getActiveLocation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { LiveRefresh } from "../live-refresh";

export default async function BillsPage() {
  const ctx = await getActiveLocation();

  if (!ctx) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Bills
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

  const currency = ctx.restaurant.currency;

  // Filtering through the table -> location relation directly avoids a
  // separate sequential round trip to pre-fetch table ids first.
  const [open, paid] = await Promise.all([
    prisma.bill.findMany({
      where: {
        table: { locationId: ctx.location.id },
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
      orderBy: { createdAt: "desc" },
      include: { table: true, items: true },
    }),
    prisma.bill.findMany({
      where: { table: { locationId: ctx.location.id }, status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 20,
      include: { table: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <LiveRefresh restaurantId={ctx.restaurant.id} />
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Bills
        </h1>
        <p className="text-muted mt-1">{ctx.restaurant.name}</p>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted">No open bills right now.</p>
        ) : (
          <div className="space-y-2">
            {open.map((b) => {
              const remaining = b.totalCents - b.amountPaidCents;
              return (
                <div
                  key={b.id}
                  className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{b.table ? `Table ${b.table.label}` : "Counter"}</p>
                    <p className="text-sm text-muted">
                      {b.items.length} {b.items.length === 1 ? "item" : "items"}
                      {b.amountPaidCents > 0
                        ? ` · ${formatCents(b.amountPaidCents, currency)} paid`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
                      {formatCents(remaining, currency)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-amber-700">
                      {b.status === "PARTIALLY_PAID" ? "Part-paid" : "Open"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Recently paid
        </h2>
        {paid.length === 0 ? (
          <p className="text-sm text-muted">No paid bills yet.</p>
        ) : (
          <div className="space-y-2">
            {paid.map((b) => (
              <div
                key={b.id}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{b.table ? `Table ${b.table.label}` : "Counter"}</p>
                  <p className="text-sm text-muted">
                    {b.paidAt
                      ? new Date(b.paidAt).toLocaleString("en-AU")
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
                      {formatCents(b.totalCents, currency)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-pine-deep">
                      Paid
                    </p>
                  </div>
                  <Link
                    href={`/receipt/${b.id}`}
                    className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-ink/30"
                  >
                    Receipt
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
