"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, getTenantContext, getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/money";
import { audit } from "@/lib/audit";
import { ALLERGEN_SET } from "@/lib/allergens";

export type MenuActionState = { error?: string };

async function requireRestaurantId(): Promise<string | null> {
  const { membership } = await getTenantContext();
  return membership?.organization.restaurants[0]?.id ?? null;
}

async function assertCategoryOwned(categoryId: string, userId: string) {
  return prisma.menuCategory.findFirst({
    where: {
      id: categoryId,
      restaurant: { organization: { memberships: { some: { userId } } } },
    },
  });
}

async function assertItemOwned(itemId: string, userId: string) {
  return prisma.menuItem.findFirst({
    where: {
      id: itemId,
      category: {
        restaurant: { organization: { memberships: { some: { userId } } } },
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

  const owned = await assertCategoryOwned(parsed.data.categoryId, authz.user.id);
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

  const owned = await assertItemOwned(itemId, authz.user.id);
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

  const owned = await assertItemOwned(itemId, authz.user.id);
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

  const owned = await assertItemOwned(parsed.data.itemId, authz.user.id);
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
          restaurant: { organization: { memberships: { some: { userId: authz.user.id } } } },
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
          restaurant: { organization: { memberships: { some: { userId: authz.user.id } } } },
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
            restaurant: { organization: { memberships: { some: { userId: authz.user.id } } } },
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
  const owned = await assertCategoryOwned(categoryId, authz.user.id);
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

// ---- Item allergens --------------------------------------------------------

export async function updateItemAllergens(
  itemId: string,
  allergens: string[],
): Promise<MenuActionState> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage")) return { error: "Not permitted." };
  const owned = await assertItemOwned(itemId, authz.user.id);
  if (!owned) return { error: "Item not found." };

  const clean = allergens.filter((a) => ALLERGEN_SET.has(a)).slice(0, 20);
  await prisma.menuItem.update({
    where: { id: itemId },
    data: { allergens: clean },
  });
  revalidatePath("/dashboard/menu");
  return {};
}
