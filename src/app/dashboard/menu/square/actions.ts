"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importCatalog, type ImportReport } from "@/lib/square/import";
import { fetchFullCatalog } from "@/lib/square/catalog";

export type SquareMenuActionState = { error?: string; report?: ImportReport };

async function requireRestaurant() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant || !authz.can("settings:manage")) {
    throw new Error("Not authorised.");
  }
  return { authz, restaurant };
}

export async function runImport(): Promise<SquareMenuActionState> {
  const { restaurant } = await requireRestaurant();

  const connection = await prisma.squareConnection.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!connection) return { error: "Connect Square first, in Settings → Integrations." };

  try {
    const report = await importCatalog(restaurant.id);
    revalidatePath("/dashboard/menu/square");
    revalidatePath("/dashboard/menu");
    return { report };
  } catch {
    return { error: "Couldn't import from Square — please try again." };
  }
}

// Manual override / initial mapping of a Tillz item to a specific Square
// item + variation, bypassing the name-matching importCatalog() does on its
// own. No Square writes — this only changes which Square variation future
// re-imports treat this Tillz item as mapped to.
export async function setItemMapping(
  menuItemId: string,
  squareItemId: string,
  squareVariationId: string,
): Promise<SquareMenuActionState> {
  const { restaurant } = await requireRestaurant();

  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, category: { restaurantId: restaurant.id } },
  });
  if (!item) return { error: "Item not found." };

  const connection = await prisma.squareConnection.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!connection) return { error: "Connect Square first, in Settings → Integrations." };

  await prisma.menuItemSquareMap.upsert({
    where: { menuItemId },
    create: { restaurantId: restaurant.id, menuItemId, squareItemId, squareVariationId },
    update: { squareItemId, squareVariationId },
  });

  revalidatePath("/dashboard/menu/square");
  return {};
}

export type SquareCatalogOption = {
  squareItemId: string;
  squareItemName: string;
  squareVariationId: string;
  squareVariationName: string;
};

// Flat item+variation list for the manual mapping dropdown. A live read
// against Square on every call (not persisted) — fine for an owner opening
// this page occasionally, not a hot path.
export async function listSquareCatalogOptions(): Promise<SquareCatalogOption[]> {
  const { restaurant } = await requireRestaurant();

  const connection = await prisma.squareConnection.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!connection) return [];

  const catalog = await fetchFullCatalog(connection);
  const options: SquareCatalogOption[] = [];
  for (const item of catalog.items) {
    for (const variation of item.variations) {
      options.push({
        squareItemId: item.id,
        squareItemName: item.name,
        squareVariationId: variation.id,
        squareVariationName: variation.name,
      });
    }
  }
  return options;
}

export async function clearItemMapping(menuItemId: string): Promise<SquareMenuActionState> {
  const { restaurant } = await requireRestaurant();

  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, category: { restaurantId: restaurant.id } },
  });
  if (!item) return { error: "Item not found." };

  await prisma.menuItemSquareMap.deleteMany({ where: { menuItemId, restaurantId: restaurant.id } });

  revalidatePath("/dashboard/menu/square");
  return {};
}
