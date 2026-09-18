import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getOrgDetail } from "@/lib/admin/queries";
import { planByTier } from "@/lib/plans";
import { formatCents } from "@/lib/money";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requirePlatformAdmin();
  const { orgId } = await params;
  const found = await getOrgDetail(orgId);
  if (!found) notFound();
  const { org, standOrders } = found;

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

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Stand orders ({standOrders.length})
        </h2>
        {standOrders.length === 0 ? (
          <p className="text-sm text-muted">No stand orders.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {standOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <span>
                  {o.quantity} stand{o.quantity === 1 ? "" : "s"} · {formatCents(o.amountCents)}
                </span>
                <span className="text-xs text-muted">{o.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
