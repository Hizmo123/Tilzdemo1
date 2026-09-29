import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { listAccountLifecycle } from "@/lib/admin/queries";
import { planByTier } from "@/lib/plans";
import { ReactivateButton } from "@/components/admin/reactivate-button";

export default async function AccountsPage() {
  await requirePlatformAdmin();

  const { suspended, deletedCount } = await listAccountLifecycle();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Accounts
        </h1>
        <p className="text-muted mt-1">
          Organisations suspended by an admin.
        </p>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
          Suspended accounts ({suspended.length})
        </h2>
        {suspended.length === 0 ? (
          <p className="text-sm text-muted">No suspended organisations.</p>
        ) : (
          <div className="space-y-3">
            {suspended.map((org) => (
              <div
                key={org.id}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-5 flex items-start justify-between gap-4 flex-wrap"
              >
                <div>
                  <Link
                    href={`/admin/orgs/${org.id}`}
                    className="font-medium hover:underline"
                  >
                    {org.name}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">
                    {planByTier(org.plan).name} · {org.planStatus}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Suspended by {org.deactivatedByEmail ?? "unknown"} on{" "}
                    {org.deactivatedAt
                      ? new Date(org.deactivatedAt).toLocaleString("en-AU")
                      : "—"}
                  </p>
                </div>
                <ReactivateButton orgId={org.id} orgName={org.name} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Deleted by their owners ({deletedCount})
        </h2>
        <p className="text-sm text-muted">
          Owners now close their own accounts instantly — there are no requests to action. Retained financial records
          for those accounts are purged from{" "}
          <Link href="/admin/deletions" className="text-pine hover:underline">
            Deletions
          </Link>{" "}
          once the retention period ends.
        </p>
      </section>
    </div>
  );
}
