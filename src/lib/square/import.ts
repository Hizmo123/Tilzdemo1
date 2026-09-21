import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchFullCatalog,
  type NormalizedCatalog,
  type NormalizedItem,
  type NormalizedModifierList,
} from "@/lib/square/catalog";

export type ImportItemResult = {
  squareItemId: string;
  squareItemName: string;
  status: "created" | "matched" | "updated" | "skipped";
  tillzItemIds: string[]; // one per variation, in multi-variation items
  reason?: string;
};

export type ImportReport = {
  categories: { created: number; matched: number };
  items: {
    created: number;
    matched: number;
    updated: number;
    skipped: number;
    results: ImportItemResult[];
  };
  modifierGroups: { created: number; updated: number };
  modifierOptions: { created: number; updated: number };
  // Tillz-native items with no Square match at all — left untouched, surfaced
  // so the owner knows they exist outside the synced set.
  unmappedTillzItems: { id: string; name: string }[];
};

function emptyReport(): ImportReport {
  return {
    categories: { created: 0, matched: 0 },
    items: { created: 0, matched: 0, updated: 0, skipped: 0, results: [] },
    modifierGroups: { created: 0, updated: 0 },
    modifierOptions: { created: 0, updated: 0 },
    unmappedTillzItems: [],
  };
}

const FALLBACK_CATEGORY_NAME = "Uncategorised";

// Reconciles one already-fetched NormalizedCatalog into Tillz menu data for
// one restaurant, inside a single transaction. Idempotent: every write is
// keyed through the *SquareMap tables on the Tillz id, so running this twice
// with the same catalog produces the same rows, not duplicates.
async function reconcile(
  tx: Prisma.TransactionClient,
  restaurantId: string,
  catalog: NormalizedCatalog,
): Promise<ImportReport> {
  const report = emptyReport();

  // ---- Categories ----------------------------------------------------------
  const existingCategories = await tx.menuCategory.findMany({ where: { restaurantId } });
  const existingCategoryMaps = await tx.menuCategorySquareMap.findMany({
    where: { restaurantId },
  });
  const categoryIdBySquareId = new Map(existingCategoryMaps.map((m) => [m.squareCategoryId, m.categoryId]));
  const categoryByLowerName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c]));
  const mappedCategoryIds = new Set(existingCategoryMaps.map((m) => m.categoryId));

  let categoryCount = existingCategories.length;
  // Square category id -> Tillz category id, built up as we go, used by item
  // reconciliation below.
  const squareCategoryIdToTillzId = new Map<string, string>(categoryIdBySquareId);

  for (const sc of catalog.categories) {
    if (squareCategoryIdToTillzId.has(sc.id)) {
      report.categories.matched++;
      continue;
    }
    const existingByName = categoryByLowerName.get(sc.name.toLowerCase());
    if (existingByName && !mappedCategoryIds.has(existingByName.id)) {
      await tx.menuCategorySquareMap.upsert({
        where: { categoryId: existingByName.id },
        create: { restaurantId, categoryId: existingByName.id, squareCategoryId: sc.id },
        update: { squareCategoryId: sc.id },
      });
      squareCategoryIdToTillzId.set(sc.id, existingByName.id);
      mappedCategoryIds.add(existingByName.id);
      report.categories.matched++;
      continue;
    }
    const created = await tx.menuCategory.create({
      data: { restaurantId, name: sc.name, sortOrder: categoryCount },
    });
    categoryCount++;
    await tx.menuCategorySquareMap.create({
      data: { restaurantId, categoryId: created.id, squareCategoryId: sc.id },
    });
    squareCategoryIdToTillzId.set(sc.id, created.id);
    mappedCategoryIds.add(created.id);
    categoryByLowerName.set(created.name.toLowerCase(), created);
    report.categories.created++;
  }

  async function fallbackCategoryId(): Promise<string> {
    const existing = categoryByLowerName.get(FALLBACK_CATEGORY_NAME.toLowerCase());
    if (existing) return existing.id;
    const created = await tx.menuCategory.create({
      data: { restaurantId, name: FALLBACK_CATEGORY_NAME, sortOrder: categoryCount },
    });
    categoryCount++;
    categoryByLowerName.set(created.name.toLowerCase(), created);
    return created.id;
  }

  // ---- Items + variations ---------------------------------------------------
  const existingItemMaps = await tx.menuItemSquareMap.findMany({ where: { restaurantId } });
  const itemMapByKey = new Map(existingItemMaps.map((m) => [`${m.squareItemId}:${m.squareVariationId}`, m]));
  const mappedMenuItemIds = new Set(existingItemMaps.map((m) => m.menuItemId));

  // Existing unmapped Tillz items, grouped by (categoryId, lower name), so a
  // Square item can claim a hand-created Tillz item of the same name/category
  // on first import instead of creating a duplicate.
  const allTillzItems = await tx.menuItem.findMany({ where: { category: { restaurantId } } });
  const unmappedByCategoryAndName = new Map<string, (typeof allTillzItems)[number]>();
  for (const it of allTillzItems) {
    if (mappedMenuItemIds.has(it.id)) continue;
    unmappedByCategoryAndName.set(`${it.categoryId}:${it.name.toLowerCase()}`, it);
  }

  // Per-menu-item sort counters so newly created items append within their
  // category rather than all landing at sortOrder 0.
  const sortCounters = new Map<string, number>();
  async function nextSortOrder(categoryId: string): Promise<number> {
    if (!sortCounters.has(categoryId)) {
      const count = await tx.menuItem.count({ where: { categoryId } });
      sortCounters.set(categoryId, count);
    }
    const n = sortCounters.get(categoryId)!;
    sortCounters.set(categoryId, n + 1);
    return n;
  }

  async function reconcileOneVariation(
    item: NormalizedItem,
    variation: NormalizedItem["variations"][number],
    name: string,
    categoryId: string,
  ): Promise<{ menuItemId: string; status: "created" | "matched" | "updated" }> {
    const key = `${item.id}:${variation.id}`;
    const existingMap = itemMapByKey.get(key);

    if (existingMap) {
      await tx.menuItem.update({
        where: { id: existingMap.menuItemId },
        data: {
          priceCents: variation.priceCents,
          description: item.description,
          ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
        },
      });
      await tx.menuItemSquareMap.update({
        where: { menuItemId: existingMap.menuItemId },
        data: { squareItemId: item.id, squareVariationId: variation.id },
      });
      return { menuItemId: existingMap.menuItemId, status: "updated" };
    }

    const nameKey = `${categoryId}:${name.toLowerCase()}`;
    const unmapped = unmappedByCategoryAndName.get(nameKey);
    if (unmapped) {
      await tx.menuItem.update({
        where: { id: unmapped.id },
        data: {
          priceCents: variation.priceCents,
          description: item.description,
          ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
        },
      });
      await tx.menuItemSquareMap.create({
        data: {
          restaurantId,
          menuItemId: unmapped.id,
          squareItemId: item.id,
          squareVariationId: variation.id,
        },
      });
      unmappedByCategoryAndName.delete(nameKey);
      mappedMenuItemIds.add(unmapped.id);
      return { menuItemId: unmapped.id, status: "matched" };
    }

    const sortOrder = await nextSortOrder(categoryId);
    const created = await tx.menuItem.create({
      data: {
        categoryId,
        name,
        description: item.description,
        priceCents: variation.priceCents,
        imageUrl: item.imageUrl,
        sortOrder,
      },
    });
    await tx.menuItemSquareMap.create({
      data: {
        restaurantId,
        menuItemId: created.id,
        squareItemId: item.id,
        squareVariationId: variation.id,
      },
    });
    mappedMenuItemIds.add(created.id);
    return { menuItemId: created.id, status: "created" };
  }

  async function reconcileModifiers(menuItemId: string, lists: NormalizedModifierList[]) {
    if (lists.length === 0) return;

    const existingGroupMaps = await tx.modifierGroupSquareMap.findMany({
      where: { restaurantId, modifierGroup: { menuItemId } },
    });
    const groupMapBySquareId = new Map(existingGroupMaps.map((m) => [m.squareModifierListId, m]));
    let groupSortOrder = await tx.modifierGroup.count({ where: { menuItemId } });

    for (const list of lists) {
      const existingGroupMap = groupMapBySquareId.get(list.id);
      let groupId: string;

      if (existingGroupMap) {
        await tx.modifierGroup.update({
          where: { id: existingGroupMap.modifierGroupId },
          data: { name: list.name, required: list.required, maxSelect: list.maxSelect },
        });
        groupId = existingGroupMap.modifierGroupId;
        report.modifierGroups.updated++;
      } else {
        const group = await tx.modifierGroup.create({
          data: {
            menuItemId,
            name: list.name,
            required: list.required,
            maxSelect: list.maxSelect,
            sortOrder: groupSortOrder++,
          },
        });
        await tx.modifierGroupSquareMap.create({
          data: { restaurantId, modifierGroupId: group.id, squareModifierListId: list.id },
        });
        groupId = group.id;
        report.modifierGroups.created++;
      }

      const existingOptionMaps = await tx.modifierOptionSquareMap.findMany({
        where: { restaurantId, modifierOption: { groupId } },
      });
      const optionMapBySquareId = new Map(existingOptionMaps.map((m) => [m.squareModifierId, m]));
      let optionSortOrder = await tx.modifierOption.count({ where: { groupId } });

      for (const mod of list.modifiers) {
        const existingOptionMap = optionMapBySquareId.get(mod.id);
        if (existingOptionMap) {
          await tx.modifierOption.update({
            where: { id: existingOptionMap.modifierOptionId },
            data: { name: mod.name, priceDeltaCents: mod.priceDeltaCents },
          });
          report.modifierOptions.updated++;
        } else {
          const option = await tx.modifierOption.create({
            data: { groupId, name: mod.name, priceDeltaCents: mod.priceDeltaCents, sortOrder: optionSortOrder++ },
          });
          await tx.modifierOptionSquareMap.create({
            data: { restaurantId, modifierOptionId: option.id, squareModifierId: mod.id },
          });
          report.modifierOptions.created++;
        }
      }
    }
  }

  for (const item of catalog.items) {
    if (item.variations.length === 0) {
      report.items.skipped++;
      report.items.results.push({
        squareItemId: item.id,
        squareItemName: item.name,
        status: "skipped",
        tillzItemIds: [],
        reason: "No variations in Square.",
      });
      continue;
    }

    const categoryId = item.categoryId
      ? (squareCategoryIdToTillzId.get(item.categoryId) ?? (await fallbackCategoryId()))
      : await fallbackCategoryId();

    const single = item.variations.length === 1;
    const tillzItemIds: string[] = [];
    // "created"/"matched"/"updated" precedence for the item-level summary:
    // an item touching multiple variations at different statuses reports the
    // most significant one (created > matched > updated).
    let worst: "created" | "matched" | "updated" = "updated";

    for (const variation of item.variations) {
      const name = single ? item.name : `${item.name} (${variation.name})`;
      const { menuItemId, status } = await reconcileOneVariation(item, variation, name, categoryId);
      tillzItemIds.push(menuItemId);
      await reconcileModifiers(menuItemId, item.modifierLists);

      if (status === "created") worst = "created";
      else if (status === "matched" && worst !== "created") worst = "matched";

      if (status === "created") report.items.created++;
      else if (status === "matched") report.items.matched++;
      else report.items.updated++;
    }

    report.items.results.push({
      squareItemId: item.id,
      squareItemName: item.name,
      status: worst,
      tillzItemIds,
    });
  }

  // ---- Unmapped Tillz items (informational only, untouched) -----------------
  const finalMaps = await tx.menuItemSquareMap.findMany({ where: { restaurantId } });
  const finalMappedIds = new Set(finalMaps.map((m) => m.menuItemId));
  report.unmappedTillzItems = allTillzItems
    .filter((it) => !finalMappedIds.has(it.id))
    .map((it) => ({ id: it.id, name: it.name }));

  return report;
}

export async function importCatalog(restaurantId: string): Promise<ImportReport> {
  const connection = await prisma.squareConnection.findUnique({ where: { restaurantId } });
  if (!connection) {
    throw new Error("No Square connection for this venue.");
  }

  const catalog = await fetchFullCatalog(connection);

  const report = await prisma.$transaction(
    async (tx) => {
      const result = await reconcile(tx, restaurantId, catalog);
      await tx.squareConnection.update({
        where: { restaurantId },
        data: { lastCatalogSyncAt: new Date() },
      });
      return result;
    },
    { timeout: 60000 }, // a full catalog can be large; a manual owner-triggered action, not a hot path
  );

  return report;
}
