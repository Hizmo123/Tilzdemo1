import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffForSlug, requireStaffOrdering } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getZReport } from "@/lib/cash-drawer";
import { formatCents } from "@/lib/money";
import { LiveRefresh } from "@/app/dashboard/live-refresh";
import { OpenDrawerForm } from "./open-drawer-form";
import { CashMovementForm } from "./cash-movement-form";
import { CloseDrawerFlow } from "./close-drawer-flow";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
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

  const { staff, restaurant } = session;
  const currency = restaurant.currency;

  // Opening/operating the drawer stays available to counter staff — same
  // permission the counter screen and table order flow use. Closing it (and
  // seeing a Z-report) is a stricter, separate check below.
  if (!roleCan(staff.role, "orders:manage")) {
    return (
      <main className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface px-5 py-4 flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Register</span>
        </header>
        <p className="max-w-2xl mx-auto px-5 py-6 text-sm text-muted">
          Your role can&apos;t operate the register.
        </p>
      </main>
    );
  }

  const canClose = roleCan(staff.role, "payments:refund");

  const locations = await prisma.location.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  // At most one location can have an open session at a time (see
  // openSession's own guard) — but several locations could each have their
  // own. Show whichever is open first; if none, offer to open one (with a
  // location picker when there's more than one to choose from).
  const openSessions = await prisma.cashDrawerSession.findMany({
    where: { restaurantId: restaurant.id, locationId: { in: locations.map((l) => l.id) }, status: "OPEN" },
  });
  const openSession = openSessions[0] ?? null;
  const openLocation = openSession
    ? locations.find((l) => l.id === openSession.locationId)
    : null;

  const report = openSession ? await getZReport(openSession.id, restaurant.id) : null;

  return (
    <main className="min-h-dvh bg-paper">
      <LiveRefresh seconds={5} restaurantId={restaurant.id} />
      <header className="border-b border-line bg-surface px-5 py-4 sticky top-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Register</span>
        </div>
        <div className="flex items-center gap-3">
          {canClose && (
            <Link
              href={`/staff/${slug}/register/history`}
              className="text-sm text-muted hover:text-ink"
            >
              History
            </Link>
          )}
          <span className="text-xs text-muted">{staff.name}</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {!openSession || !report ? (
          <OpenDrawerForm slug={slug} locations={locations} />
        ) : (
          <>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {openLocation?.name ?? "Drawer"} — open
                </h2>
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-pine-soft text-pine-deep">
                  Open
                </span>
              </div>
              <p className="text-xs text-muted">
                Opened by {report.openedByName} at{" "}
                {new Date(report.openedAt).toLocaleTimeString("en-AU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>

              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">Opening float</span>
                  <span className="tabular-nums">
                    {formatCents(report.openingFloatCents, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Cash sales</span>
                  <span className="tabular-nums">
                    {formatCents(report.salesByTender.cash, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Card sales</span>
                  <span className="tabular-nums">
                    {formatCents(report.salesByTender.card, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Other sales</span>
                  <span className="tabular-nums">
                    {formatCents(report.salesByTender.other, currency)}
                  </span>
                </div>
                <div className="flex justify-between font-medium border-t border-line pt-1 mt-1">
                  <span>Expected cash</span>
                  <span className="tabular-nums">
                    {formatCents(report.expectedCashCents, currency)}
                  </span>
                </div>
              </div>

              <CashMovementForm slug={slug} sessionId={openSession.id} />
            </div>

            {canClose && (
              <CloseDrawerFlow
                slug={slug}
                sessionId={openSession.id}
                restaurantName={restaurant.name}
                locationName={openLocation?.name ?? ""}
                currency={currency}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
