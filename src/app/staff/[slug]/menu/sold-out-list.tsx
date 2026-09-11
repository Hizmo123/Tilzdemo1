"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { staffSetAvailable } from "./actions";
import { formatCents } from "@/lib/money";

type Item = { id: string; name: string; priceCents: number; available: boolean };
type Category = { id: string; name: string; items: Item[] };

export function SoldOutList({
  slug,
  currency,
  categories,
}: {
  slug: string;
  currency: string;
  categories: Category[];
}) {
  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <section key={cat.id}>
          <h3 className="text-sm font-medium text-muted mb-2">{cat.name}</h3>
          <ul className="space-y-2">
            {cat.items.map((item) => (
              <Row key={item.id} slug={slug} currency={currency} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({
  slug,
  currency,
  item,
}: {
  slug: string;
  currency: string;
  item: Item;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    start(async () => {
      const res = await staffSetAvailable(slug, item.id, !item.available);
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className={`font-medium ${item.available ? "" : "text-muted"}`}>
          {item.name}
        </span>
        <span className="block text-sm text-muted tabular-nums">
          {formatCents(item.priceCents, currency)}
        </span>
        {error && <span className="block text-xs text-danger mt-1">{error}</span>}
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          item.available
            ? "border border-line hover:border-danger/40"
            : "bg-pine text-white hover:bg-pine-deep"
        }`}
      >
        {pending
          ? "…"
          : item.available
            ? "Mark sold out"
            : "Mark available"}
      </button>
    </li>
  );
}
