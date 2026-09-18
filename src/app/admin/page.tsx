import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformOverview, getRecentActivity, getFulfilmentCounts } from "@/lib/admin/queries";
import { planByTier } from "@/lib/plans";
import { formatCents } from "@/lib/money";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function AdminHomePage() {
  await requirePlatformAdmin();
  const [overview, activity, fulfilment] = await Promise.all([
    getPlatformOverview(),
    getRecentActivity(),
    getFulfilmentCounts(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Platform overview
        </h1>
        <p className="text-muted mt-1">Read-only. v1 — no cross-tenant mutations here.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">Revenue</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="MRR" value={formatCents(overview.mrrCents)} />
          {overview.mrrByTier.map((t) => (
            <Stat
              key={t.tier}
              label={`${planByTier(t.tier).name} MRR`}
              value={formatCents(t.mrrCents)}
              sub={`${t.orgs} org${t.orgs === 1 ? "" : "s"}`}
            />
          ))}
        </div>
        {overview.orgsOverVenueLimit > 0 && (
          <p className="text-xs text-muted mt-2">
            {overview.orgsOverVenueLimit} org{overview.orgsOverVenueLimit === 1 ? "" : "s"} over
            their plan&apos;s venue limit — no per-venue overage price is configured in this
            codebase yet, so this isn&apos;t counted in MRR above.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">Subscriptions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Active" value={String(overview.subscriptions.active)} />
          <Stat label="In grace period" value={String(overview.subscriptions.inGrace)} />
          <Stat label="Lapsed (blocked)" value={String(overview.subscriptions.lapsed)} />
          <Stat label="Free tier" value={String(overview.subscriptions.free)} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">Totals</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Organisations" value={String(overview.totals.organisations)} />
          <Stat label="Venues" value={String(overview.totals.venues)} />
          <Stat label="Onboarded" value={String(overview.totals.published)} />
          <Stat label="Not yet onboarded" value={String(overview.totals.unpublished)} />
        </div>
        <p className="text-xs text-muted mt-2">
          No separate publish/unpublish flag exists in this codebase — &quot;onboarded&quot; uses
          Restaurant.onboardingCompletedAt as the closest available proxy for &quot;live&quot;.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">Stand fulfilment</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Awaiting print" value={String(fulfilment.awaitingPrint)} />
          <Stat label="Awaiting shipment" value={String(fulfilment.awaitingShip)} />
        </div>
        <Link
          href="/admin/fulfilment"
          className="text-xs text-pine hover:underline mt-2 inline-block"
        >
          Open fulfilment queue →
        </Link>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">Activation funnel</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Signed up" value={String(overview.funnel.signedUp)} />
          <Stat label="Completed onboarding" value={String(overview.funnel.completedOnboarding)} />
          <Stat label="Onboarded venues" value={String(overview.funnel.published)} />
          <Stat label="Placed a first order" value={String(overview.funnel.firstOrder)} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted">Nothing recorded yet.</p>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface divide-y divide-line">
            {activity.map((row) => (
              <div key={row.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
                <span>
                  <span className="font-medium">{row.organizationName}</span>{" "}
                  <span className="text-muted">
                    · {row.action} · {row.actorEmail || "system"}
                  </span>
                </span>
                <span className="text-xs text-muted shrink-0">
                  {new Date(row.createdAt).toLocaleString("en-AU")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
