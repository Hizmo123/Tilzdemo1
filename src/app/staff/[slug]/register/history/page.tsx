import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffForSlug, requireStaffOrdering, requireStaffCounterAllowed } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { listSessions, getZReport } from "@/lib/cash-drawer";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

// Z-report history is manager-level — same payments:refund permission the
// close-drawer action itself requires (see register/actions.ts#closeDrawer).
// Opening/operating a drawer stays available to counter staff; only seeing
// past reconciliations is gated this tightly.
export default async function RegisterHistoryPage({
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
  const currency = restaurant.currency;

  if (!roleCan(staff.role, "payments:refund")) {
    return (
      <main className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface px-5 py-4 flex items-center gap-3">
          <Link href={`/staff/${slug}/register`} className="text-sm text-muted hover:text-ink">
            ← Register
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">History</span>
        </header>
        <p className="max-w-2xl mx-auto px-5 py-6 text-sm text-muted">
          Your role can&apos;t view drawer history.
        </p>
      </main>
    );
  }

  const sessions = await listSessions(restaurant.id);
  const reports = await Promise.all(
    sessions.map((s) => getZReport(s.id, restaurant.id)),
  );

  return (
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface px-5 py-4 sticky top-0 flex items-center gap-3">
        <Link href={`/staff/${slug}/register`} className="text-sm text-muted hover:text-ink">
          ← Register
        </Link>
        <span className="font-display text-lg font-semibold tracking-tight">
          Drawer history
        </span>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s, i) => {
              const report = reports[i];
              return (
                <Link
                  key={s.id}
                  href={`/staff/${slug}/register/history/${s.id}`}
                  className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:border-pine/40 transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {s.openedAt.toLocaleDateString("en-AU")} · {s.openedByName}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {s.status === "OPEN"
                        ? "Still open"
                        : `Closed ${s.closedAt?.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {report?.varianceCents != null ? (
                      <p
                        className={`font-medium tabular-nums ${
                          report.varianceCents !== 0 ? "text-danger" : "text-pine-deep"
                        }`}
                      >
                        {report.varianceCents >= 0 ? "+" : "−"}
                        {formatCents(Math.abs(report.varianceCents), currency)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted">—</p>
                    )}
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      {s.status}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
