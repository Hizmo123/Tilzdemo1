import { prisma } from "@/lib/prisma";
import { MenuEditor } from "./menu-editor";

// The one part of /dashboard/menu that actually waits on the database — split
// out so the header (name, "Import from CSV" link — no DB dependency beyond
// the already-cached tenant lookup the layout just did) can stream
// immediately behind a Suspense boundary instead of blocking on this query.
export async function MenuListData({
  restaurantId,
  currency,
  kitchenStations,
}: {
  restaurantId: string;
  currency: string;
  kitchenStations: string[];
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

  return (
    <MenuEditor categories={categories} currency={currency} kitchenStations={kitchenStations} />
  );
}
