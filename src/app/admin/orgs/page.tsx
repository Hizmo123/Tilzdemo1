import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { searchOrganizations } from "@/lib/admin/queries";
import { planByTier } from "@/lib/plans";

export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q } = await searchParams;
  const orgs = await searchOrganizations(q);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Organisations
        </h1>
        <p className="text-muted mt-1">
          Read-only in v1 — no impersonation yet (a future task).
        </p>
      </div>

      <form method="GET" className="flex gap-2 max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name"
          className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm focus:border-pine focus:outline-none"
        />
        <button
          type="submit"
          className="text-sm rounded-lg border border-line px-3.5 py-2 hover:border-ink/30"
        >
          Search
        </button>
      </form>

      {orgs.length === 0 ? (
        <p className="text-sm text-muted">No organisations found.</p>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface divide-y divide-line">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/admin/orgs/${org.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-paper transition-colors"
            >
              <span>
                <span className="font-medium">{org.name}</span>{" "}
                <span className="text-muted">
                  · {planByTier(org.plan).name} · {org.restaurants.length} venue
                  {org.restaurants.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="text-xs text-muted shrink-0">
                {new Date(org.createdAt).toLocaleDateString("en-AU")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
