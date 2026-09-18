import Link from "next/link";
import { getActiveLocation, getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAND_UNIT_PRICE_CENTS } from "@/lib/plans";
import { OrderStandsForm } from "./order-stands-form";

export default async function OrderStandsPage() {
  const authz = await getAuthz();
  const ctx = await getActiveLocation();

  if (!ctx) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Order physical stands
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

  if (!authz.can("settings:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Order physical stands
        </h1>
        <p className="text-muted">You don&apos;t have permission to order stands.</p>
      </div>
    );
  }

  const tables = await prisma.table.findMany({
    where: { locationId: ctx.location.id, active: true },
    orderBy: [{ section: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, section: true },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/dashboard/tables" className="text-sm text-muted hover:text-ink">
          ← Tables
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          Order physical stands
        </h1>
        <p className="text-muted mt-1">
          Pick which tables need a printed Tillz stand. {ctx.restaurant.name}
        </p>
      </div>

      <OrderStandsForm
        tables={tables}
        currency={ctx.restaurant.currency}
        unitPriceCents={STAND_UNIT_PRICE_CENTS}
      />
    </div>
  );
}
