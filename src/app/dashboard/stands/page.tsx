import Link from "next/link";
import { getActiveLocation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStandsForm } from "./order-stands-form";

export default async function StandsPage() {
  const ctx = await getActiveLocation();

  if (!ctx) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Order Tillz stands
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

  const [tables, activeStands, orders, products] = await Promise.all([
    prisma.table.findMany({
      where: { locationId: ctx.location.id },
      orderBy: [{ section: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tillzStand.findMany({
      where: { restaurantId: ctx.restaurant.id, status: "ACTIVE" },
      select: { tableId: true },
    }),
    prisma.standOrder.findMany({
      where: { restaurantId: ctx.restaurant.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.standProduct.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const tablesWithStand = new Set(
    activeStands.map((s) => s.tableId).filter((id): id is string => !!id),
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Order Tillz stands
        </h1>
        <p className="text-muted mt-1">
          A physical table-top card, mailed to you.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-muted">No stands available to order yet.</p>
        </div>
      ) : (
        <OrderStandsForm
          products={products.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            imageUrl: p.imageUrl,
            type: p.type,
            priceCents: p.priceCents,
            allowsCustomDesign: p.allowsCustomDesign,
            requiresCustomDesign: p.requiresCustomDesign,
            designGuidelines: p.designGuidelines,
            maxDesignSizeMb: p.maxDesignSizeMb,
            acceptedDesignMimeTypes: p.acceptedDesignMimeTypes,
          }))}
          tables={tables.map((t) => ({
            id: t.id,
            label: t.label,
            section: t.section,
            hasStand: tablesWithStand.has(t.id),
          }))}
        />
      )}

      {orders.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
            Past orders
          </h2>
          <div className="space-y-2">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {o.quantity} stand{o.quantity === 1 ? "" : "s"} · $
                    {(o.totalCents / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {o.createdAt.toLocaleDateString("en-AU")}
                  </p>
                </div>
                <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-[var(--radius-xs)] bg-paper text-muted">
                  {o.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
