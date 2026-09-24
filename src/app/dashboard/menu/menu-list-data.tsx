import { prisma } from "@/lib/prisma";
import { ItemsView } from "./items-view";
import { CategoriesView } from "./categories-view";
import type { MenuView } from "./menu-types";

// The one part of /dashboard/menu that actually waits on the database — split
// out so the header and tabs (no DB dependency beyond the already-cached
// tenant lookup the layout just did) can stream immediately behind a
// Suspense boundary instead of blocking on this query. One query serves
// both tabs: the items table needs category names/stations per row, and the
// category list needs item counts.
export async function MenuListData({
  restaurantId,
  restaurantName,
  currency,
  kitchenStations,
  view,
}: {
  restaurantId: string;
  restaurantName: string;
  currency: string;
  kitchenStations: string[];
  view: MenuView;
}) {
  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          modifierGroups: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              options: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            },
          },
        },
      },
    },
  });

  if (view === "categories") {
    return (
      <CategoriesView
        categories={categories}
        restaurantName={restaurantName}
        kitchenStations={kitchenStations}
      />
    );
  }

  return <ItemsView categories={categories} currency={currency} stations={kitchenStations} />;
}
