import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SquareMappingClient } from "./square-mapping-client";
import { buttonClasses } from "@/components/ui/button-classes";

// A map row created in the same transaction as its MenuItem (a fresh item
// Square produced) will have createdAt timestamps effectively identical to
// the item's own. A map row attached to a pre-existing, hand-authored item
// (matched by category + name during import) will have a MUCH earlier item
// createdAt than the map's. There's no separate "how was this mapped"
// column in the schema (the task didn't ask for one), so this gap is used
// as a heuristic to label the difference in the UI only — it never affects
// import/reconcile behaviour itself.
const AUTO_MATCH_GAP_MS = 5000;

export default async function SquareMenuPage() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return <p className="text-muted">Create your restaurant first from the Overview page.</p>;
  }
  if (!authz.can("settings:manage")) {
    return <p className="text-muted">You don&apos;t have permission to manage this.</p>;
  }

  const connection = await prisma.squareConnection.findUnique({
    where: { restaurantId: restaurant.id },
    select: { lastCatalogSyncAt: true },
  });

  if (!connection) {
    return (
      <div className="space-y-4 max-w-lg">
        <div>
          <Link href="/dashboard/menu" className="text-sm text-muted hover:text-ink">
            ← Menu
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
            Square catalog
          </h1>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <p className="font-medium">Connect Square first</p>
          <p className="text-sm text-muted mt-1.5">
            Importing your menu from Square needs a connected account.
          </p>
          <Link
            href="/dashboard/settings/integrations"
            className={buttonClasses("primary", "sm", false, "mt-4")}
          >
            Go to Integrations
          </Link>
        </div>
      </div>
    );
  }

  const items = await prisma.menuItem.findMany({
    where: { category: { restaurantId: restaurant.id } },
    include: { category: true, squareMap: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  const rows = items.map((item) => {
    let status: "unmapped" | "mapped" | "auto_matched" = "unmapped";
    if (item.squareMap) {
      const gap = item.squareMap.createdAt.getTime() - item.createdAt.getTime();
      status = gap < AUTO_MATCH_GAP_MS ? "mapped" : "auto_matched";
    }
    return {
      id: item.id,
      name: item.name,
      categoryName: item.category.name,
      status,
      squareItemId: item.squareMap?.squareItemId ?? null,
      squareVariationId: item.squareMap?.squareVariationId ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/menu" className="text-sm text-muted hover:text-ink">
          ← Menu
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          Square catalog
        </h1>
        <p className="text-muted mt-1">
          Import your menu from Square, or manually map items that didn&apos;t
          match automatically.
        </p>
        <p className="text-sm text-muted mt-1">
          {connection.lastCatalogSyncAt
            ? `Last imported ${connection.lastCatalogSyncAt.toLocaleString("en-AU")}`
            : "Never imported yet."}
        </p>
      </div>

      <SquareMappingClient
        initialRows={rows}
        hasSynced={!!connection.lastCatalogSyncAt}
      />
    </div>
  );
}
