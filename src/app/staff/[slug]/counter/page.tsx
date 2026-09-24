import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffForSlug, requireStaffOrdering, requireStaffCounterAllowed } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listOpenCounterBills } from "@/lib/bills";
import { formatCents } from "@/lib/money";
import { LiveRefresh } from "@/app/dashboard/live-refresh";
import { NewSaleForm } from "./new-sale-form";

export const dynamic = "force-dynamic";

export default async function CounterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await requireStaffForSlug(slug);
  if (!session) redirect(`/staff/${slug}`);
  // HARD guard: LITE has no live ordering to run any of this against — see
  // lib/staff-auth.ts#requireStaffOrdering for why this is NOT
  // lib/auth.ts#requireOrdering (owner Supabase session vs staff PIN session).
  await requireStaffOrdering(session.restaurant.organizationId, slug);
  // HARD guard: Connect has no counter/cash-drawer workflow — Square handles
  // the venue's own in-person payments — see lib/staff-auth.ts#requireStaffCounterAllowed.
  await requireStaffCounterAllowed(session.restaurant.organizationId, slug);

  const { staff, restaurant } = session;

  if (!roleCan(staff.role, "orders:manage")) {
    return (
      <main className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface px-5 py-4 flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Counter</span>
        </header>
        <p className="max-w-2xl mx-auto px-5 py-6 text-sm text-muted">
          Your role can&apos;t take orders.
        </p>
      </main>
    );
  }

  const [locations, sales] = await Promise.all([
    prisma.location.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    listOpenCounterBills(restaurant.id),
  ]);

  return (
    <main className="min-h-dvh bg-paper">
      <LiveRefresh seconds={5} restaurantId={restaurant.id} />
      <header className="border-b border-line bg-surface px-5 py-4 sticky top-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Counter</span>
        </div>
        <span className="text-xs text-muted">{staff.name}</span>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        <NewSaleForm slug={slug} locations={locations} />

        <div>
          <h2 className="text-sm font-medium text-muted mb-3">Open sales</h2>
          {sales.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
              <p className="text-muted">No open counter sales.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sales.map((s) => (
                <Link
                  key={s.id}
                  href={`/staff/${slug}/counter/${s.id}`}
                  className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:border-pine/40 transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {s.itemCount} {s.itemCount === 1 ? "item" : "items"}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {s.createdAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
                      {formatCents(s.totalCents - s.amountPaidCents, restaurant.currency)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-warn">
                      {s.status === "PARTIALLY_PAID" ? "Part-paid" : "Open"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
