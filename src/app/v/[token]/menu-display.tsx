"use client";

import { useMemo } from "react";
import Image from "next/image";
import { formatCents } from "@/lib/money";
import { BADGE_META, type BadgeKey } from "@/lib/menu-badges";
import type { OrderCategory } from "@/components/order/menu-orderer";
import { CategoryNav, sectionId, useScrollSpy } from "@/components/order/category-tabs";
import {
  resolveCardStyle,
  resolveTypeScale,
  aspectClass,
  cardBorderClass,
  cardShadowClass,
  dividerClass,
  sectionHeaderClass,
  MENU_HEADLINE_FONT,
  type CardStyle,
} from "@/lib/menu-style";

export function ItemBadges({ badges, allergens = [] }: { badges: string[]; allergens?: string[] }) {
  const known = badges.filter((b): b is BadgeKey => b in BADGE_META);
  if (known.length === 0 && allergens.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {known.map((b) => {
        const meta = BADGE_META[b];
        return (
          <span key={b} className={`text-[10px] font-medium rounded-pill px-2 py-0.5 leading-4 ${meta.className}`}>
            {meta.label}
          </span>
        );
      })}
      {allergens.map((a) => (
        <span key={a} className="text-[10px] font-medium rounded-pill px-2 py-0.5 leading-4 bg-surface-2 text-muted">
          {a}
        </span>
      ))}
    </div>
  );
}

// Intentional "no photo" art: a tinted gradient panel with the item's
// initial, so an unphotographed item still looks designed rather than
// missing something.
export function PhotoFallback({ name, className = "" }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={`w-full h-full flex items-center justify-center bg-accent-gradient text-on-accent ${className}`}
    >
      <span className="font-display text-display-sm font-semibold opacity-70">{name.trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}

type Item = OrderCategory["items"][number];
type TypeSize = ReturnType<typeof resolveTypeScale>;

function ItemCard({ item, cs, ts, currency }: { item: Item; cs: CardStyle; ts: TypeSize; currency: string }) {
  const showImage = cs.imagePosition !== "none";
  const top = cs.imagePosition === "top";

  const imageEl = showImage ? (
    <div
      className={`relative overflow-hidden shrink-0 bg-surface-2 ${
        top ? `w-full ${aspectClass(cs.imageAspect)}` : "w-[72px] h-[72px] rounded-[var(--radius-md)]"
      }`}
    >
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          fill
          sizes={top ? "(min-width: 768px) 360px, 50vw" : "72px"}
          className={`object-cover ${item.available ? "" : "grayscale opacity-60"}`}
        />
      ) : (
        <PhotoFallback name={item.name} />
      )}
      {!item.available && top && (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-surface/90 text-muted px-2 py-0.5 rounded-pill">
          Sold out
        </span>
      )}
    </div>
  ) : null;

  const textEl = (
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span style={{ fontSize: ts.itemName }} className={`${MENU_HEADLINE_FONT} font-semibold leading-snug ${item.available ? "" : "text-muted"}`}>
          {item.name}
        </span>
        <span style={{ fontSize: ts.itemPrice }} className={`${MENU_HEADLINE_FONT} font-semibold tabular shrink-0`}>
          {formatCents(item.priceCents, currency)}
        </span>
      </div>
      {item.description && (
        <p style={{ fontSize: ts.itemDesc }} className="text-muted mt-0.5 line-clamp-2">
          {item.description}
        </p>
      )}
      {!item.available && !top && (
        <span className="inline-block mt-1 text-[10px] uppercase tracking-wide bg-surface-2 text-muted px-2 py-0.5 rounded-pill">
          Sold out
        </span>
      )}
      <ItemBadges badges={item.badges} allergens={item.allergens} />
    </div>
  );

  if (top) {
    return (
      <div className={`rounded-[var(--radius-card)] bg-surface overflow-hidden flex flex-col ${cardBorderClass(cs.border)} ${cardShadowClass(cs.shadow)}`}>
        {imageEl}
        <div className="p-3.5 flex-1">{textEl}</div>
      </div>
    );
  }
  return (
    <div className={`rounded-[var(--radius-card)] bg-surface p-3.5 flex items-start gap-3.5 ${cardBorderClass(cs.border)} ${cardShadowClass(cs.shadow)}`}>
      {imageEl}
      {textEl}
    </div>
  );
}

function MinimalRow({ item, ts, currency }: { item: Item; ts: TypeSize; currency: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <div className="min-w-0">
        <span style={{ fontSize: ts.itemName }} className={`${MENU_HEADLINE_FONT} font-semibold ${item.available ? "" : "text-muted"}`}>
          {item.name}
        </span>
        {!item.available && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-muted">Sold out</span>
        )}
        {item.description && (
          <p style={{ fontSize: ts.itemDesc }} className="text-muted mt-0.5">
            {item.description}
          </p>
        )}
      </div>
      <span className="flex-1 border-b border-dotted border-line-strong translate-y-[-4px] min-w-4" aria-hidden />
      <span style={{ fontSize: ts.itemPrice }} className={`${MENU_HEADLINE_FONT} font-semibold tabular shrink-0`}>
        {formatCents(item.priceCents, currency)}
      </span>
    </div>
  );
}

// Read-only menu — shown when customer self-ordering is turned off, and as
// the Lite public menu at /m/[slug]. Same look as the interactive menu
// (photos, badges, layout choice) but no Add buttons.
export function MenuDisplay({
  menu,
  currency,
  layout = "list",
  cardStyle,
  sectionHeaderStyle = "plain",
  typeScale = "comfortable",
}: {
  menu: OrderCategory[];
  currency: string;
  layout?: string;
  cardStyle?: unknown;
  sectionHeaderStyle?: string;
  typeScale?: string;
}) {
  const cs = resolveCardStyle(layout, cardStyle);
  const ts = resolveTypeScale(typeScale);
  const isGrid = layout === "grid";
  const isMagazine = layout === "magazine";
  const isMinimal = layout === "minimal";
  const topImages = cs.imagePosition === "top";

  const ids = useMemo(() => menu.map((c) => c.id), [menu]);
  const { activeId, scrollTo } = useScrollSpy(ids);

  return (
    <div>
      <CategoryNav categories={menu} activeId={activeId} onSelect={scrollTo} />

      <div className={`pt-4 ${isMagazine ? "space-y-12" : "space-y-9"}`}>
        {menu.map((cat) => (
          <section key={cat.id} id={sectionId(cat.id)} className="scroll-mt-28">
            <h3
              style={{ fontSize: isMagazine ? `calc(${ts.categoryHeader} + 6px)` : ts.categoryHeader }}
              className={`${MENU_HEADLINE_FONT} font-semibold tracking-tight mb-3.5 flex items-center gap-2 ${sectionHeaderClass(sectionHeaderStyle)}`}
            >
              {cat.icon && <span aria-hidden>{cat.icon}</span>}
              {cat.name}
            </h3>

            {isMinimal ? (
              <div className={dividerClass(cs.divider) ? "divide-y divide-line" : ""}>
                {cat.items.map((item) => (
                  <MinimalRow key={item.id} item={item} ts={ts} currency={currency} />
                ))}
              </div>
            ) : isGrid || topImages ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {cat.items.map((item) => (
                  <ItemCard key={item.id} item={item} cs={cs} ts={ts} currency={currency} />
                ))}
              </div>
            ) : (
              <div className={`grid gap-3 md:grid-cols-2 ${isMagazine ? "sm:gap-4" : ""}`}>
                {cat.items.map((item) => (
                  <ItemCard key={item.id} item={item} cs={cs} ts={ts} currency={currency} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
