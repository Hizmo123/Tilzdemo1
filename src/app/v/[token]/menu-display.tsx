"use client";

import Image from "next/image";
import { formatCents } from "@/lib/money";
import { BADGE_META, type BadgeKey } from "@/lib/menu-badges";
import type { OrderCategory } from "@/components/order/menu-orderer";
import {
  resolveCardStyle,
  resolveTypeScale,
  aspectClass,
  cardBorderClass,
  cardShadowClass,
  dividerClass,
  sectionHeaderClass,
  type CardStyle,
} from "@/lib/menu-style";

function ItemBadges({ badges }: { badges: string[] }) {
  const known = badges.filter((b): b is BadgeKey => b in BADGE_META);
  if (known.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {known.map((b) => {
        const meta = BADGE_META[b];
        return (
          <span
            key={b}
            className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${meta.className}`}
          >
            {meta.emoji} {meta.label}
          </span>
        );
      })}
    </div>
  );
}

type Item = OrderCategory["items"][number];
type TypeSize = ReturnType<typeof resolveTypeScale>;

// One item's card, shape driven entirely by the resolved CardStyle — the
// same component renders list/grid/magazine (only the OUTER container
// differs between those three; see MenuDisplay below). "minimal" never
// mounts this — it has its own text-only row further down.
function ItemCard({
  item,
  categoryIcon,
  cs,
  ts,
  currency,
}: {
  item: Item;
  categoryIcon: string | null;
  cs: CardStyle;
  ts: TypeSize;
  currency: string;
}) {
  const showImage = cs.imagePosition !== "none";
  const imageEl = showImage ? (
    <div
      className={`bg-paper relative overflow-hidden shrink-0 ${
        cs.imagePosition === "left" ? `w-16 h-16 rounded-lg` : `w-full ${aspectClass(cs.imageAspect)}`
      }`}
    >
      {item.imageUrl ? (
        // The busiest image on the busiest page (every menu item card) — a
        // real next/image win: responsive srcset + format conversion instead
        // of shipping the original upload at full size to every device.
        <Image
          src={item.imageUrl}
          alt=""
          fill
          sizes={cs.imagePosition === "left" ? "64px" : "(min-width: 640px) 400px, 100vw"}
          className="object-cover"
        />
      ) : cs.imagePosition === "top" ? (
        <div className="w-full h-full flex items-center justify-center text-muted text-xs">
          {categoryIcon || "No photo"}
        </div>
      ) : null}
      {!item.available && cs.imagePosition === "top" && (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-surface/90 text-muted px-1.5 py-0.5 rounded">
          Sold out
        </span>
      )}
    </div>
  ) : null;

  const textEl = (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span
          style={{ fontSize: ts.itemName }}
          className={`font-medium ${item.available ? "" : "text-muted"}`}
        >
          {item.name}
        </span>
        {!item.available && cs.imagePosition !== "top" && (
          <span className="text-[10px] uppercase tracking-wide bg-paper text-muted px-1.5 py-0.5 rounded shrink-0">
            Sold out
          </span>
        )}
      </div>
      {item.description && (
        <p style={{ fontSize: ts.itemDesc }} className="text-muted mt-0.5">
          {item.description}
        </p>
      )}
      <ItemBadges badges={item.badges} />
      {item.allergens.length > 0 && (
        <p className="text-[11px] text-muted mt-1">Contains: {item.allergens.join(", ")}</p>
      )}
      <p style={{ fontSize: ts.itemPrice }} className="font-medium mt-1 tabular-nums">
        {formatCents(item.priceCents, currency)}
      </p>
    </div>
  );

  if (cs.imagePosition === "top") {
    return (
      <div
        className={`rounded-[var(--radius-card)] bg-surface overflow-hidden flex flex-col ${cardBorderClass(cs.border)} ${cardShadowClass(cs.shadow)}`}
      >
        {imageEl}
        <div className="p-3 flex-1">{textEl}</div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[var(--radius-card)] bg-surface p-4 flex items-start gap-3 ${cardBorderClass(cs.border)} ${cardShadowClass(cs.shadow)}`}
    >
      {imageEl}
      {textEl}
    </div>
  );
}

function MinimalRow({ item, ts, currency }: { item: Item; ts: TypeSize; currency: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <span style={{ fontSize: ts.itemName }} className={`font-medium ${item.available ? "" : "text-muted"}`}>
          {item.name}
        </span>
        {!item.available && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted">Sold out</span>
        )}
        {item.description && (
          <p style={{ fontSize: ts.itemDesc }} className="text-muted mt-0.5">
            {item.description}
          </p>
        )}
      </div>
      <span style={{ fontSize: ts.itemPrice }} className="font-medium tabular-nums shrink-0">
        {formatCents(item.priceCents, currency)}
      </span>
    </div>
  );
}

// Read-only menu — shown when customer self-ordering is turned off. Same look
// as the interactive menu (photos, badges, layout choice) but no Add buttons.
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

  return (
    <div className={isMagazine ? "space-y-10" : "space-y-6"}>
      {menu.map((cat) => (
        <section key={cat.id}>
          <h3
            style={{ fontSize: isMagazine ? `calc(${ts.categoryHeader} + 4px)` : ts.categoryHeader }}
            className={`font-display font-semibold tracking-tight mb-3 flex items-center gap-1.5 ${sectionHeaderClass(sectionHeaderStyle)}`}
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
          ) : isGrid ? (
            <div className="grid grid-cols-2 gap-3">
              {cat.items.map((item) => (
                <ItemCard key={item.id} item={item} categoryIcon={cat.icon} cs={cs} ts={ts} currency={currency} />
              ))}
            </div>
          ) : (
            <div className={`space-y-2 ${isMagazine ? "sm:space-y-4" : ""}`}>
              {cat.items.map((item, i) => (
                <div key={item.id} className={i < cat.items.length - 1 ? dividerClass(cs.divider) : ""}>
                  <ItemCard item={item} categoryIcon={cat.icon} cs={cs} ts={ts} currency={currency} />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
