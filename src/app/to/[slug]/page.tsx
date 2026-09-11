import { prisma } from "@/lib/prisma";
import { isOpenNow, isWithinWindow, parseHours } from "@/lib/hours";
import { themeVars } from "@/lib/theme";
import type { OrderCategory } from "@/components/order/menu-orderer";
import { TakeawayOrderer } from "./takeaway-orderer";

export const dynamic = "force-dynamic";

// Public pickup/takeaway ordering page for a venue (not tied to a table).
export default async function TakeawayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      menuCategories: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          items: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              modifierGroups: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                include: {
                  options: {
                    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const style = restaurant
    ? themeVars({
        theme: restaurant.theme,
        themeMode: restaurant.themeMode,
        fontTheme: restaurant.fontTheme,
        brandColor: restaurant.brandColor,
      })
    : undefined;

  if (!restaurant || !restaurant.takeawayEnabled) {
    return (
      <main
        style={style}
        className="min-h-dvh bg-paper flex items-center justify-center px-6 text-center"
      >
        <p className="text-muted">Pickup ordering isn&apos;t available here.</p>
      </main>
    );
  }

  const open = isOpenNow(parseHours(restaurant.hours), restaurant.timezone);

  const menu: OrderCategory[] = restaurant.menuCategories
    .filter((c) => isWithinWindow(c.availableFrom, c.availableTo, restaurant.timezone))
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        priceCents: i.priceCents,
        available: i.available,
        imageUrl: i.imageUrl,
        allergens: i.allergens,
        groups: i.modifierGroups.map((g) => ({
          id: g.id,
          name: g.name,
          required: g.required,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({
            id: o.id,
            name: o.name,
            priceDeltaCents: o.priceDeltaCents,
          })),
        })),
      })),
    }));

  return (
    <TakeawayOrderer
      slug={slug}
      restaurantName={restaurant.name}
      logoUrl={restaurant.logoUrl}
      currency={restaurant.currency}
      themeStyle={style}
      open={open}
      menu={menu}
    />
  );
}
