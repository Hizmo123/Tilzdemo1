import Link from "next/link";
import { Suspense } from "react";
import { getActiveLocation } from "@/lib/auth";
import { MenuListData } from "./menu-list-data";

function MenuSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-40 rounded-[var(--radius-card)] bg-line/40" />
      <div className="h-40 rounded-[var(--radius-card)] bg-line/40" />
    </div>
  );
}

export default async function MenuPage() {
  const ctx = await getActiveLocation();

  if (!ctx) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Menu
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Menu
          </h1>
          <p className="text-muted mt-1">{ctx.restaurant.name}</p>
        </div>
        <Link
          href="/dashboard/menu/import"
          className="shrink-0 text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
        >
          Import from CSV
        </Link>
      </div>

      <Suspense fallback={<MenuSkeleton />}>
        <MenuListData
          restaurantId={ctx.restaurant.id}
          restaurantName={ctx.restaurant.name}
          currency={ctx.restaurant.currency}
          kitchenStations={ctx.restaurant.kitchenStations}
        />
      </Suspense>
    </div>
  );
}
