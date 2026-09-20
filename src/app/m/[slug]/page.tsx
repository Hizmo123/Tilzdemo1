import { prisma } from "@/lib/prisma";
import { getMenuForCustomer } from "@/lib/bills";
import { getEntitlements } from "@/lib/entitlements";
import { themeVars } from "@/lib/theme";
import { MenuDisplay } from "@/app/v/[token]/menu-display";

export const dynamic = "force-dynamic";

// Lite's single public menu — one URL/QR for every table, view-only: no
// cart, no "add to order", no bill/pay, no call-staff. Reuses MenuDisplay
// as-is (it's already the read-only presentation component — see its own
// doc comment: "shown when customer self-ordering is turned off... no Add
// buttons") rather than a stripped-down copy of the interactive menu.
//
export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
  });

  if (!restaurant || !restaurant.published) {
    return <NotAvailable />;
  }

  const [menuRows, ent] = await Promise.all([
    getMenuForCustomer(restaurant.id),
    getEntitlements(restaurant.organizationId),
  ]);

  const menu = menuRows.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      priceCents: i.priceCents,
      available: i.available,
      imageUrl: i.imageUrl,
      allergens: i.allergens,
      badges: i.badges,
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
    <main
      className="min-h-dvh bg-paper text-ink"
      style={themeVars({
        theme: restaurant.theme,
        themeMode: restaurant.themeMode,
        fontTheme: restaurant.fontTheme,
        brandColor: restaurant.brandColor,
        cornerStyle: restaurant.cornerStyle,
      })}
    >
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="text-center mb-8">
          {restaurant.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={restaurant.logoUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover mx-auto mb-3"
            />
          ) : null}
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {restaurant.name}
          </h1>
          {restaurant.tagline && (
            <p className="text-sm text-muted mt-1">{restaurant.tagline}</p>
          )}
        </div>

        {menu.length === 0 ? (
          <p className="text-center text-sm text-muted">
            This restaurant hasn&apos;t published its menu yet.
          </p>
        ) : (
          <MenuDisplay
            menu={menu}
            currency={restaurant.currency}
            layout={restaurant.menuLayout}
            cardStyle={restaurant.cardStyle}
            sectionHeaderStyle={restaurant.sectionHeaderStyle}
            typeScale={restaurant.typeScale}
          />
        )}

        {ent.showTillzBranding && (
          <p className="mt-8 text-center text-[11px] text-muted">
            Powered by{" "}
            <a href="/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
              Tillz
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

function NotAvailable() {
  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Menu not available yet
        </h1>
        <p className="text-sm text-muted mt-2">
          This link isn&apos;t serving a menu right now. Please check back
          later.
        </p>
      </div>
    </main>
  );
}
