"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, getTenantContext, getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/money";
import { audit } from "@/lib/audit";
import { ALLERGEN_SET } from "@/lib/allergens";
import { BADGE_VALUES } from "@/lib/menu-badges";
import { canCreateStation } from "@/lib/entitlements";
import { deleteAllMenuData } from "@/lib/menu-import";

const BADGE_SET = new Set<string>(BADGE_VALUES);

export type MenuActionState = { error?: string };

async function requireRestaurantId(): Promise<string | null> {
  const { membership } = await getTenantContext();
  return membership?.organization.restaurants[0]?.id ?? null;
}

// Takes organizationId — the SAME membership's org that authz.can() already
// checked the role against — not userId. "Any org this user belongs to" is a
// different, broader question than "does this belong to the org my role
// applies to," and answering the broader one here is exactly how a user who
// is e.g. OWNER on their own org and VIEW_ONLY on a second org could act
// with their OWNER role against the second org's menu. See getAuthz()'s doc
// comment in lib/auth.ts.
async function assertCategoryOwned(categoryId: string, organizationId: string) {
  return prisma.menuCategory.findFirst({
    where: {
      id: categoryId,
      restaurant: { organizationId },
    },
  });
}

async function assertItemOwned(itemId: string, organizationId: string) {
  return prisma.menuItem.findFirst({
    where: {
      id: itemId,
      category: {
        restaurant: { organizationId },
      },
    },
    include: { category: true },
  });
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(60),
});

export async function createCategory(
  _prev: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage"))
    return { error: "You don't have permission to edit the menu." };

  const restaurantId = await requireRestaurantId();
  if (!restaurantId) return { error: "Create your restaurant first." };

  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const count = await prisma.menuCategory.count({ where: { restaurantId } });
  const cat = await prisma.menuCategory.create({
    data: { restaurantId, name: parsed.data.name, sortOrder: count },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "menu.category.created",
    resourceType: "MenuCategory",
    resourceId: cat.id,
    metadata: { name: cat.name },
  });

  revalidatePath("/dashboard/menu");
  return {};
}

const itemSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1, "Enter an item name.").max(80),
  description: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
  price: z.string().trim().min(1, "Enter a price."),
});

export async function createItem(
  _prev: MenuActionState,
  formData: FormData,
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage"))
    return { error: "You don't have permission to edit the menu." };

  const parsed = itemSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const owned = await assertCategoryOwned(parsed.data.categoryId, authz.membership!.organizationId);
  if (!owned) return { error: "Category not found." };

  const priceCents = dollarsToCents(parsed.data.price);
  if (priceCents === null)
    return { error: "Enter a valid price, e.g. 24 or 24.50." };

  const count = await prisma.menuItem.count({
    where: { categoryId: parsed.data.categoryId },
  });
  const item = await prisma.menuItem.create({
    data: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description,
      priceCents,
      sortOrder: count,
    },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "menu.item.created",
    resourceType: "MenuItem",
    resourceId: item.id,
    metadata: { name: item.name, priceCents },
  });

  revalidatePath("/dashboard/menu");
  return {};
}

// Sold-out toggle (spec §28) — allowed for STAFF too, via menu:availability.
export async function toggleItemAvailable(itemId: string, available: boolean) {
  const authz = await getAuthz();
  if (!authz.can("menu:availability"))
    return { error: "You don't have permission to change availability." };

  const owned = await assertItemOwned(itemId, authz.membership!.organizationId);
  if (!owned) return { error: "Item not found." };

  await prisma.menuItem.update({ where: { id: itemId }, data: { available } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "menu.item.availability",
    resourceType: "MenuItem",
    resourceId: itemId,
    metadata: { name: owned.name, available },
  });

  revalidatePath("/dashboard/menu");
  return { ok: true as const };
}

export async function deleteItem(itemId: string) {
  const authz = await getAuthz();
  if (!authz.can("menu:manage"))
    return { error: "You don't have permission to edit the menu." };

  const owned = await assertItemOwned(itemId, authz.membership!.organizationId);
  if (!owned) return { error: "Item not found." };

  await prisma.menuItem.delete({ where: { id: itemId } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "menu.item.deleted",
    resourceType: "MenuItem",
    resourceId: itemId,
    metadata: { name: owned.name },
  });

  revalidatePath("/dashboard/menu");
  return { ok: true as const };
}

// ---- Modifiers (spec §27) --------------------------------------------------

const groupSchema = z.object({
  itemId: z.string().min(1),
  name: z.string().trim().min(1, "Enter a group name.").max(60),
  required: z.boolean(),
  maxSelect: z.number().int().min(0).max(20),
});

export async function createModifierGroup(input: {
  itemId: string;
  name: string;
  required: boolean;
  maxSelect: number;
}): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage"))
    return { error: "You don't have permission to edit the menu." };

  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const owned = await assertItemOwned(parsed.data.itemId, authz.membership!.organizationId);
  if (!owned) return { error: "Item not found." };

  const count = await prisma.modifierGroup.count({
    where: { menuItemId: parsed.data.itemId },
  });
  await prisma.modifierGroup.create({
    data: {
      menuItemId: parsed.data.itemId,
      name: parsed.data.name,
      required: parsed.data.required,
      maxSelect: parsed.data.maxSelect,
      sortOrder: count,
    },
  });

  revalidatePath("/dashboard/menu");
  return {};
}

export async function deleteModifierGroup(groupId: string) {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };

  const owned = await prisma.modifierGroup.findFirst({
    where: {
      id: groupId,
      menuItem: {
        category: {
          restaurant: { organizationId: authz.membership!.organizationId },
        },
      },
    },
  });
  if (!owned) return { error: "Group not found." };

  await prisma.modifierGroup.delete({ where: { id: groupId } });
  revalidatePath("/dashboard/menu");
  return { ok: true as const };
}

const optionSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1, "Enter an option name.").max(60),
  price: z.string().trim(),
});

export async function createModifierOption(input: {
  groupId: string;
  name: string;
  price: string;
}): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage"))
    return { error: "You don't have permission to edit the menu." };

  const parsed = optionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const owned = await prisma.modifierGroup.findFirst({
    where: {
      id: parsed.data.groupId,
      menuItem: {
        category: {
          restaurant: { organizationId: authz.membership!.organizationId },
        },
      },
    },
  });
  if (!owned) return { error: "Group not found." };

  // Empty price means +$0. Otherwise parse dollars to cents.
  let deltaCents = 0;
  if (parsed.data.price) {
    const c = dollarsToCents(parsed.data.price);
    if (c === null) return { error: "Enter a valid price like 2 or 2.50." };
    deltaCents = c;
  }

  const count = await prisma.modifierOption.count({
    where: { groupId: parsed.data.groupId },
  });
  await prisma.modifierOption.create({
    data: {
      groupId: parsed.data.groupId,
      name: parsed.data.name,
      priceDeltaCents: deltaCents,
      sortOrder: count,
    },
  });

  revalidatePath("/dashboard/menu");
  return {};
}

export async function deleteModifierOption(optionId: string) {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };

  const owned = await prisma.modifierOption.findFirst({
    where: {
      id: optionId,
      group: {
        menuItem: {
          category: {
            restaurant: { organizationId: authz.membership!.organizationId },
          },
        },
      },
    },
  });
  if (!owned) return { error: "Option not found." };

  await prisma.modifierOption.delete({ where: { id: optionId } });
  revalidatePath("/dashboard/menu");
  return { ok: true as const };
}

// ---- Category options: prep station + availability window ------------------

function normalizeTime(v: string | undefined | null): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}

export async function updateCategoryOptions(
  categoryId: string,
  opts: { station?: string; availableFrom?: string; availableTo?: string },
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const owned = await assertCategoryOwned(categoryId, authz.membership!.organizationId);
  if (!owned) return { error: "Category not found." };

  await prisma.menuCategory.update({
    where: { id: categoryId },
    data: {
      station: opts.station?.trim().slice(0, 24) || null,
      availableFrom: normalizeTime(opts.availableFrom),
      availableTo: normalizeTime(opts.availableTo),
    },
  });
  revalidatePath("/dashboard/menu");
  return {};
}

// Per-item prep station override — null falls back to the category's station
// (see BillItem creation in lib/bills.ts, which reads item.station first).
export async function updateItemStation(
  itemId: string,
  station: string,
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const owned = await assertItemOwned(itemId, authz.membership!.organizationId);
  if (!owned) return { error: "Item not found." };

  await prisma.menuItem.update({
    where: { id: itemId },
    data: { station: station.trim().slice(0, 24) || null },
  });
  revalidatePath("/dashboard/menu");
  return {};
}

// The venue's own list of prep station names (e.g. "Barista", "Grill",
// "Oven") — offered as choices in the category/item station pickers, and on
// the kitchen screen's station tabs. Not a foreign key: renaming or removing
// one here doesn't touch categories/items already routed to the old name.
export async function updateKitchenStations(
  names: string[],
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const restaurantId = await requireRestaurantId();
  if (!restaurantId) return { error: "Create your restaurant first." };

  const clean = Array.from(
    new Set(
      names
        .map((n) => n.trim().slice(0, 24))
        .filter((n) => n.length > 0),
    ),
  );
  if (clean.length === 0) clean.push("Kitchen");

  // Plan-gated, not a hardcoded cap — but only enforced when this save
  // actually GROWS the station count (a new station being added). Renaming
  // or removing stations, or simply re-saving the same set, never gets
  // blocked here — same "never take away what already works" rule as
  // canCreateTable (see lib/entitlements.ts).
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { kitchenStations: true },
  });
  if (clean.length > (restaurant?.kitchenStations.length ?? 0)) {
    const check = await canCreateStation(authz.membership!.organizationId);
    if (!check.allowed) return { error: check.reason };
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { kitchenStations: clean },
  });
  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard/settings/service");
  return {};
}

// ---- Item allergens --------------------------------------------------------

export async function updateItemAllergens(
  itemId: string,
  allergens: string[],
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const owned = await assertItemOwned(itemId, authz.membership!.organizationId);
  if (!owned) return { error: "Item not found." };

  const clean = allergens.filter((a) => ALLERGEN_SET.has(a)).slice(0, 20);
  await prisma.menuItem.update({
    where: { id: itemId },
    data: { allergens: clean },
  });
  revalidatePath("/dashboard/menu");
  return {};
}

// A single emoji next to the category name on the customer menu. Any short
// string is accepted (emoji are typically 1-4 UTF-16 code units after
// combining marks/ZWJ sequences) — capped generously rather than validated
// against a strict emoji regex, which is more trouble than it's worth here.
export async function updateCategoryIcon(
  categoryId: string,
  icon: string,
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const owned = await assertCategoryOwned(categoryId, authz.membership!.organizationId);
  if (!owned) return { error: "Category not found." };

  const clean = icon.trim().slice(0, 8);
  await prisma.menuCategory.update({
    where: { id: categoryId },
    data: { icon: clean || null },
  });
  revalidatePath("/dashboard/menu");
  return {};
}

export async function updateItemBadges(
  itemId: string,
  badges: string[],
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const owned = await assertItemOwned(itemId, authz.membership!.organizationId);
  if (!owned) return { error: "Item not found." };

  const clean = badges.filter((b) => BADGE_SET.has(b)).slice(0, BADGE_VALUES.length);
  await prisma.menuItem.update({
    where: { id: itemId },
    data: { badges: clean },
  });
  revalidatePath("/dashboard/menu");
  return {};
}

// ---- Category delete / rename / reorder ------------------------------------

// Deletes a category and everything under it (items, modifier groups/
// options, Square catalog mappings — all cascade off MenuCategory, see
// prisma/schema.prisma and the comment on deleteAllMenuData in
// lib/menu-import.ts for the full chain). A past order's BillItems are
// unaffected — menuItemId is nullable with onDelete: SetNull, so they keep
// their name/price snapshot and just lose the live link.
export async function deleteCategoryAction(categoryId: string) {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };

  const owned = await assertCategoryOwned(categoryId, authz.membership!.organizationId);
  if (!owned) return { error: "Category not found." };

  const itemCount = await prisma.menuItem.count({ where: { categoryId } });
  await prisma.menuCategory.delete({ where: { id: categoryId } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "menu.category.deleted",
    resourceType: "MenuCategory",
    resourceId: categoryId,
    metadata: { name: owned.name, itemCount },
  });

  revalidatePath("/dashboard/menu");
  return { ok: true as const };
}

const renameSchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(60),
});

export async function renameCategoryAction(
  categoryId: string,
  newName: string,
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };

  const parsed = renameSchema.safeParse({ name: newName });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const owned = await assertCategoryOwned(categoryId, authz.membership!.organizationId);
  if (!owned) return { error: "Category not found." };

  await prisma.menuCategory.update({
    where: { id: categoryId },
    data: { name: parsed.data.name },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "menu.category.renamed",
    resourceType: "MenuCategory",
    resourceId: categoryId,
    metadata: { from: owned.name, to: parsed.data.name },
  });

  revalidatePath("/dashboard/menu");
  return {};
}

// Persists a full drag/up-down reorder from the dashboard in one call. The
// given id list must be EXACTLY this restaurant's current category set (no
// more, no fewer, nothing foreign) — this is the ownership check, not just a
// courtesy: a category from another venue could never sneak an id into a
// list that has to match 1:1 against this restaurant's own categories.
export async function reorderCategoriesAction(
  orderedCategoryIds: string[],
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const restaurantId = await requireRestaurantId();
  if (!restaurantId) return { error: "Create your restaurant first." };

  const existing = await prisma.menuCategory.findMany({
    where: { restaurantId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((c) => c.id));
  const isExactMatch =
    orderedCategoryIds.length === existing.length &&
    orderedCategoryIds.every((id) => existingIds.has(id)) &&
    new Set(orderedCategoryIds).size === orderedCategoryIds.length;
  if (!isExactMatch) {
    return { error: "That category list doesn't match your menu — refresh and try again." };
  }

  await prisma.$transaction(
    orderedCategoryIds.map((id, i) =>
      prisma.menuCategory.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );

  revalidatePath("/dashboard/menu");
  // Customer-facing surfaces (MenuDisplay, MenuOrderer) both read categories
  // via the one shared lib/bills.ts#getMenuForCustomer query, ordered by
  // sortOrder — no separate revalidation needed for them to pick this up.
  return {};
}

// ---- Delete the whole menu ---------------------------------------------------

export type DeleteMenuState =
  | { error: string }
  | { ok: true; categoriesDeleted: number; itemsDeleted: number };

// Reuses deleteAllMenuData (lib/menu-import.ts) — the exact same primitive
// commitMenuImport's "replace" mode uses — rather than a second copy of the
// same deletion logic.
export async function deleteWholeMenuAction(): Promise<DeleteMenuState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const restaurantId = await requireRestaurantId();
  if (!restaurantId) return { error: "Create your restaurant first." };

  const result = await prisma.$transaction(
    (tx) => deleteAllMenuData(tx, restaurantId),
    { timeout: 15000 },
  );

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "menu.deleted_all",
    resourceType: "Restaurant",
    resourceId: restaurantId,
    metadata: result,
  });

  revalidatePath("/dashboard/menu");
  return { ok: true, ...result };
}
