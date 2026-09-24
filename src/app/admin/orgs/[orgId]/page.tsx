import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getOrgDetail } from "@/lib/admin/queries";
import { planByTier, PLANS } from "@/lib/plans";
import { SuspendButton } from "@/components/admin/suspend-button";
import { ReactivateButton } from "@/components/admin/reactivate-button";
import { ClearRequestButton } from "@/components/admin/clear-request-button";
import { ChangePlanForm } from "@/components/admin/change-plan-form";
import { LapsedToggle } from "@/components/admin/lapsed-toggle";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requirePlatformAdmin();
  const { orgId } = await params;
  const found = await getOrgDetail(orgId);
  if (!found) notFound();
  const { org } = found;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/admin/orgs" className="text-sm text-muted hover:text-ink">
          ← Organisations
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          {org.name}
        </h1>
        <p className="text-muted mt-1">
          {planByTier(org.plan).name} plan · {org.planStatus}
          {org.subscriptionLapsedAt &&
            ` · lapsed ${new Date(org.subscriptionLapsedAt).toLocaleDateString("en-AU")}`}
        </p>
      </div>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Admin controls
        </h2>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-paper text-muted">
            {planByTier(org.plan).name}
          </span>
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-paper text-muted">
            {org.planStatus}
          </span>
          {org.subscriptionLapsedAt && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-warn-soft text-warn">
              Lapsed {new Date(org.subscriptionLapsedAt).toLocaleDateString("en-AU")}
            </span>
          )}
          {org.deactivatedAt && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-danger-soft text-danger">
              Suspended by {org.deactivatedByEmail ?? "unknown"} on{" "}
              {new Date(org.deactivatedAt).toLocaleDateString("en-AU")}
            </span>
          )}
        </div>

        {org.deletionRequestedAt && (
          <div className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft/40 p-3 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-ink">
              Deletion requested by {org.deletionRequestedByEmail ?? "unknown"} on{" "}
              {new Date(org.deletionRequestedAt).toLocaleDateString("en-AU")}.
            </p>
            <ClearRequestButton orgId={org.id} orgName={org.name} />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted mb-1.5">Suspension</p>
            {org.deactivatedAt ? (
              <ReactivateButton orgId={org.id} orgName={org.name} />
            ) : (
              <SuspendButton orgId={org.id} orgName={org.name} />
            )}
          </div>
          <div>
            <p className="text-xs text-muted mb-1.5">Lapsed status</p>
            <LapsedToggle orgId={org.id} lapsed={!!org.subscriptionLapsedAt} />
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted mb-1.5">Plan</p>
            <ChangePlanForm
              orgId={org.id}
              currentTier={org.plan}
              tiers={PLANS.map((p) => ({ tier: p.tier, name: p.name }))}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Venues ({org.restaurants.length})
        </h2>
        {org.restaurants.length === 0 ? (
          <p className="text-sm text-muted">No venues yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {org.restaurants.map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span>{r.name}</span>
                <span className="text-xs text-muted">
                  {r.onboardingCompletedAt ? "Onboarded" : "Not onboarded"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Team ({org.memberships.length})
        </h2>
        {org.memberships.length === 0 ? (
          <p className="text-sm text-muted">No members.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {org.memberships.map((m) => (
              <li key={m.email} className="flex items-center justify-between">
                <span>{m.email}</span>
                <span className="text-xs text-muted">{m.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
