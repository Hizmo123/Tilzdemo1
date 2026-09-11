import Link from "next/link";
import { getActiveLocation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MenuEditor } from "./menu-editor";

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

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          modifierGroups: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              options: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Menu
        </h1>
        <p className="text-muted mt-1">{ctx.restaurant.name}</p>
      </div>

      <MenuEditor categories={categories} currency={ctx.restaurant.currency} />
    </div>
  );
}
