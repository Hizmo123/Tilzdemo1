"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MenuOrderer, type OrderCategory } from "@/components/order/menu-orderer";
import { placeTakeaway } from "./actions";

type Placed = { number: number | null; items: { name: string; quantity: number }[] };

export function TakeawayOrderer({
  slug,
  restaurantName,
  logoUrl,
  currency,
  themeStyle,
  open,
  menu,
}: {
  slug: string;
  restaurantName: string;
  logoUrl: string | null;
  currency: string;
  themeStyle?: CSSProperties;
  open: boolean;
  menu: OrderCategory[];
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [placed, setPlaced] = useState<Placed | null>(null);
  const numberRef = useRef<number | null>(null);

  async function onSubmit(
    lines: { menuItemId: string; quantity: number; optionIds: string[] }[],
    note?: string,
    clientRequestId?: string,
  ) {
    if (name.trim().length < 1) {
      return { error: "Please enter your name first." };
    }
    const res = await placeTakeaway(
      slug,
      name.trim(),
      lines,
      note,
      clientRequestId,
      phone.trim() || undefined,
    );
    if ("error" in res) return { error: res.error };
    numberRef.current = res.orderNumber ?? null;
    return { ok: true as const };
  }

  const Header = (
    <div className="text-center mb-6">
      {logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl}
          alt={restaurantName}
          className="h-12 w-auto mx-auto mb-2 object-contain"
        />
      ) : (
        <p className="text-sm font-medium text-pine">Pickup order</p>
      )}
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {restaurantName}
      </h1>
      <p className="text-muted text-sm mt-0.5">Order for pickup</p>
    </div>
  );

  if (placed) {
    const total = placed.items.reduce((n, l) => n + l.quantity, 0);
    return (
      <main style={themeStyle} className="min-h-dvh bg-paper text-ink">
        <div className="max-w-sm mx-auto px-5 pt-10 min-h-dvh flex flex-col justify-center">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-pine-soft text-pine-deep flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Order placed
            </h1>
            {placed.number != null && (
              <p className="font-display text-4xl font-semibold tracking-tight mt-3 text-pine">
                #{placed.number}
              </p>
            )}
            <p className="text-muted mt-2 text-sm">
              {name}, we&apos;ll call your name / number when it&apos;s ready.
              Please pay at the counter when you collect.
            </p>
            <p className="text-xs text-muted mt-3">
              {total} {total === 1 ? "item" : "items"}
            </p>
            <button
              onClick={() => {
                setPlaced(null);
                setName("");
              }}
              className="mt-6 w-full rounded-xl border border-line py-3 font-medium hover:border-ink/30"
            >
              Start another order
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={themeStyle} className="min-h-dvh bg-paper text-ink">
      <div className="max-w-sm mx-auto px-5 pt-8">
        {Header}

        {!open ? (
          <div className="rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 p-4 mb-4 text-center">
            <p className="font-medium text-amber-800">We&apos;re closed right now</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Pickup ordering opens during trading hours.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="text-sm text-muted block mb-1">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sam"
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
              />
            </div>
            <div className="mb-5">
              <label className="text-sm text-muted block mb-1">
                Mobile <span className="text-xs">(optional — for an “order ready” text)</span>
              </label>
              <input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="04xx xxx xxx"
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
              />
            </div>

            {menu.length === 0 ? (
              <p className="text-sm text-muted text-center">
                Nothing on the menu right now.
              </p>
            ) : (
              <MenuOrderer
                menu={menu}
                currency={currency}
                reviewStep
                submitLabel={(n) => `Review pickup order · ${n}`}
                onSubmit={onSubmit}
                onPlaced={(summary) =>
                  setPlaced({ number: numberRef.current, items: summary })
                }
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
