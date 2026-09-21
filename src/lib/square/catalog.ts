import type { SquareConnection } from "@prisma/client";
import type { Square } from "square";
import { squareClientFor } from "@/lib/square/client";

// Read-only: fetches and normalises a venue's full Square catalog. Never
// writes to Square. See lib/square/import.ts for reconciling this into
// Tillz menu data.

export type NormalizedModifier = {
  id: string; // Square MODIFIER id
  name: string;
  priceDeltaCents: number;
};

export type NormalizedModifierList = {
  id: string; // Square MODIFIER_LIST id
  name: string;
  required: boolean;
  maxSelect: number;
  modifiers: NormalizedModifier[];
};

export type NormalizedVariation = {
  id: string; // Square ITEM_VARIATION id
  name: string;
  priceCents: number;
};

export type NormalizedItem = {
  id: string; // Square ITEM id
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string | null; // Square CATEGORY id
  variations: NormalizedVariation[];
  modifierLists: NormalizedModifierList[];
};

export type NormalizedCategory = {
  id: string; // Square CATEGORY id
  name: string;
};

export type NormalizedCatalog = {
  categories: NormalizedCategory[];
  items: NormalizedItem[];
  modifierLists: NormalizedModifierList[];
};

function moneyToCents(money: Square.Money | undefined | null): number {
  if (!money?.amount) return 0;
  return Number(money.amount);
}

export async function fetchFullCatalog(connection: SquareConnection): Promise<NormalizedCatalog> {
  const client = await squareClientFor(connection);

  const categoriesById = new Map<string, Square.CatalogObject.Category>();
  const modifierListsById = new Map<string, Square.CatalogObject.ModifierList>();
  const imagesById = new Map<string, Square.CatalogObject.Image>();
  const itemObjects: Square.CatalogObject.Item[] = [];

  // core.Page's async iterator pages through the full catalog on its own
  // (following the response cursor) — no manual cursor loop needed.
  const page = await client.catalog.list({ types: "ITEM,CATEGORY,MODIFIER_LIST,IMAGE" });
  for await (const obj of page) {
    // Every real catalog object Square returns has an id — only ever absent
    // on a locally-constructed object being sent TO Square, which never
    // happens in this read-only path.
    if (!obj.id) continue;
    switch (obj.type) {
      case "CATEGORY":
        categoriesById.set(obj.id, obj);
        break;
      case "MODIFIER_LIST":
        modifierListsById.set(obj.id, obj);
        break;
      case "IMAGE":
        imagesById.set(obj.id, obj);
        break;
      case "ITEM":
        itemObjects.push(obj);
        break;
      default:
        break;
    }
  }

  function normalizeModifierList(obj: Square.CatalogObject.ModifierList): NormalizedModifierList {
    const data = obj.modifierListData;
    const min = data?.minSelectedModifiers != null ? Number(data.minSelectedModifiers) : 0;
    const max = data?.maxSelectedModifiers != null ? Number(data.maxSelectedModifiers) : 0;
    const modifiers: NormalizedModifier[] = (data?.modifiers ?? [])
      .filter((m): m is Square.CatalogObject.Modifier => m.type === "MODIFIER")
      .filter((m) => !!m.id)
      .map((m) => ({
        id: m.id!,
        name: m.modifierData?.name ?? "Option",
        priceDeltaCents: moneyToCents(m.modifierData?.priceMoney),
      }));
    return {
      id: obj.id!,
      name: data?.name ?? "Options",
      required: min >= 1,
      maxSelect: max > 0 ? max : 1,
      modifiers,
    };
  }

  const categories: NormalizedCategory[] = [...categoriesById.values()].map((c) => ({
    id: c.id!,
    name: c.categoryData?.name ?? "Uncategorised",
  }));

  const modifierLists: NormalizedModifierList[] = [...modifierListsById.values()].map(
    normalizeModifierList,
  );

  const items: NormalizedItem[] = itemObjects.map((obj) => {
    const data = obj.itemData;

    const categoryId =
      data?.categories?.[0]?.id ?? data?.categoryId ?? null;

    const imageId = data?.imageIds?.[0];
    const imageUrl = imageId ? (imagesById.get(imageId)?.imageData?.url ?? null) : null;

    const variations: NormalizedVariation[] = (data?.variations ?? [])
      .filter((v): v is Square.CatalogObject.ItemVariation => v.type === "ITEM_VARIATION")
      .filter((v) => !!v.id)
      .map((v) => ({
        id: v.id!,
        name: v.itemVariationData?.name ?? "Regular",
        priceCents: moneyToCents(v.itemVariationData?.priceMoney),
      }));

    const itemModifierLists: NormalizedModifierList[] = (data?.modifierListInfo ?? [])
      .map((info) => modifierListsById.get(info.modifierListId))
      .filter((obj): obj is Square.CatalogObject.ModifierList => !!obj)
      .map(normalizeModifierList);

    return {
      id: obj.id!,
      name: data?.name ?? "Untitled item",
      description: data?.description ?? null,
      imageUrl,
      categoryId,
      variations,
      modifierLists: itemModifierLists,
    };
  });

  return { categories, items, modifierLists };
}
