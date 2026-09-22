import { prisma } from "@/lib/prisma";
import { getMenuForCustomer } from "@/lib/bills";
import { getEntitlements } from "@/lib/entitlements";
import { themeVars } from "@/lib/theme";
import { patternBackgroundStyle } from "@/lib/menu-style";
import { MenuDisplay } from "@/app/v/[token]/menu-display";

export const dynamic = "force-dynamic";

// Lite's single public menu — one URL/QR for every table, view-only: no
// cart, no "add to order", no bill/pay, no call-staff. Reuses MenuDisplay
// as-is (it's already the read-only presentation component — see its own
// doc comment: "shown when customer self-ordering is turned off... no Add
// buttons") rather than a stripped-down copy of the interactive menu.
//
// Server component, so the entrance is CSS (animate-fade-up with staggered
// delays) rather than the motion library — same feel as the table landing.
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

  const initial = restaurant.name.trim().charAt(0).toUpperCase();

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
      <div className="max-w-md md:max-w-3xl mx-auto pb-12">
        <div className="relative h-44 sm:h-52 md:h-64 md:rounded-b-[var(--radius-xl)] overflow-hidden animate-fade-up">
          {restaurant.coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={restaurant.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
          ) : (
            <>
              <div className="absolute inset-0 bg-accent-gradient" />
              <div aria-hidden className="absolute inset-0" style={{ ...patternBackgroundStyle("dots", "#ffffff"), opacity: 0.18 }} />
            </>
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, var(--color-paper) 0%, color-mix(in srgb, var(--color-paper) 35%, transparent) 55%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative -mt-11 px-5 text-center">
          <div className="mx-auto w-20 h-20 rounded-[var(--radius-lg)] shadow-float overflow-hidden ring-4 ring-[var(--color-paper)] bg-surface animate-pop" style={{ animationDelay: "80ms" }}>
            {restaurant.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={restaurant.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent-gradient text-on-accent flex items-center justify-center font-display text-display-sm font-semibold">
                {initial}
              </div>
            )}
          </div>
          <h1 className="font-display text-display font-semibold mt-4 animate-fade-up" style={{ animationDelay: "140ms" }}>
            {restaurant.name}
          </h1>
          {restaurant.tagline && (
            <p className="text-sm text-ink-soft mt-1 animate-fade-up" style={{ animationDelay: "200ms" }}>
              {restaurant.tagline}
            </p>
          )}
        </div>

        <div className="px-5 mt-8 animate-fade-up" style={{ animationDelay: "260ms" }}>
          {menu.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
              This restaurant hasn&apos;t published its menu yet.
            </div>
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
            <p className="mt-10 text-center text-[11px] text-muted">
              Powered by{" "}
              <a href="/" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-ink">
                Tillz
              </a>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function NotAvailable() {
  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center rounded-[var(--radius-card)] bg-surface shadow-raised p-8 animate-fade-up">
        <h1 className="font-display text-display-sm font-semibold">Menu not available yet</h1>
        <p className="text-sm text-muted mt-2">
          This link isn&apos;t serving a menu right now. Please check back later.
        </p>
      </div>
    </main>
  );
}
