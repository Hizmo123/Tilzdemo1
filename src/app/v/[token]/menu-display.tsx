"use client";

import { formatCents } from "@/lib/money";
import type { OrderCategory } from "@/components/order/menu-orderer";

// Read-only menu — shown when customer self-ordering is turned off. Same look as
// the interactive menu (photos, prices, options hint) but no Add buttons.
export function MenuDisplay({
  menu,
  currency,
}: {
  menu: OrderCategory[];
  currency: string;
}) {
  return (
    <div className="space-y-6">
      {menu.map((cat) => (
        <section key={cat.id}>
          <h3 className="font-display text-lg font-semibold tracking-tight mb-2">
            {cat.name}
          </h3>
          <ul className="space-y-2">
            {cat.items.map((item) => (
              <li
                key={item.id}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-start gap-3"
              >
                {item.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${item.available ? "" : "text-muted"}`}
                    >
                      {item.name}
                    </span>
                    {!item.available && (
                      <span className="text-[10px] uppercase tracking-wide bg-paper text-muted px-1.5 py-0.5 rounded">
                        Sold out
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted mt-0.5">{item.description}</p>
                  )}
                  {item.allergens.length > 0 && (
                    <p className="text-[11px] text-muted mt-1">
                      Contains: {item.allergens.join(", ")}
                    </p>
                  )}
                  <p className="text-sm font-medium mt-1 tabular-nums">
                    {formatCents(item.priceCents, currency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
