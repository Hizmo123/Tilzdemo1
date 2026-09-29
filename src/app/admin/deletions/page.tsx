import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { listDeletedOrganizations } from "@/lib/admin/queries";
import { getRetainedCounts, purgeEligibility } from "@/lib/admin/account-purge";
import { PurgePanel } from "./purge-panel";

const DAY_MS = 24 * 60 * 60 * 1000;
const fmt = (d: Date | null) =>
  d ? d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "—";

// Organisations whose owners deleted them. Everything non-financial was
// removed at deletion time; what's listed here is the Payment/Refund/Bill/
// Order/StandOrder records still held for the statutory retention period.
// Purging them is deliberately a person's decision on this page — there is no
// scheduled job — so anything past its date sits here, visibly, until someone
// acts.
export default async function DeletionsPage() {
  await requirePlatformAdmin();

  const orgs = await listDeletedOrganizations();
  const rows = await Promise.all(
    orgs.map(async (org) => ({ org, retained: await getRetainedCounts(org.id), eligibility: purgeEligibility(org) })),
  );
  const ready = rows.filter((r) => "ok" in r.eligibility).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Deleted accounts</h1>
        <p className="text-muted mt-1">
          Closed by their owners. Their financial records are retained until the date shown, then purged here by hand
          ({rows.length} total{ready > 0 ? `, ${ready} ready to purge` : ""}).
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No deleted accounts.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ org, retained, eligibility }) => {
            const eligible = "ok" in eligibility;
            const msLeft = org.deletionPurgeEligibleAt ? org.deletionPurgeEligibleAt.getTime() - Date.now() : null;
            return (
              <div key={org.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <Link href={`/admin/orgs/${org.id}`} className="font-medium hover:underline">
                      {org.name}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      Deleted by {org.deletedByEmail ?? "unknown"} on {fmt(org.deletionExecutedAt)}
                    </p>
                    <p className="text-xs text-muted mt-0.5 tabular-nums">
                      Retained: {retained.bills} bills · {retained.payments} payments · {retained.refunds} refunds ·{" "}
                      {retained.orders} orders · {retained.standOrders} stand orders
                    </p>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] ${
                      eligible ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"
                    }`}
                  >
                    {eligible
                      ? "Eligible for purge"
                      : msLeft !== null
                        ? `Retain until ${fmt(org.deletionPurgeEligibleAt)} · ${Math.ceil(msLeft / DAY_MS).toLocaleString("en-AU")} days`
                        : "No retention date"}
                  </span>
                </div>
                <PurgePanel
                  orgId={org.id}
                  orgName={org.name}
                  eligible={eligible}
                  eligibleOn={fmt(org.deletionPurgeEligibleAt)}
                  retained={retained}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
