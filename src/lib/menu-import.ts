import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/money";
import { parseCsv, toCsvRow } from "@/lib/csv";
import { ALLERGEN_OPTIONS } from "@/lib/allergens";
import { BADGE_VALUES } from "@/lib/menu-badges";

// ---- Template ----------------------------------------------------------------

export const MENU_IMPORT_HEADER = [
  "Category",
  "Item Name",
  "Description",
  "Price",
  "Allergens",
  "Badges",
  "Available",
  "Modifier Group",
  "Modifier Required",
  "Modifier Max Select",
  "Modifier Options",
];

// A template with the header plus a couple of worked examples — one with a
// modifier group, one without — so the columns are self-explanatory without a
// separate instructions doc. Modifiers are deliberately a single group per
// row: a flat CSV can't cleanly express "one item, several modifier groups"
// without a lot of extra columns most venues will never use, so an item that
// needs more than one group is best finished off in the menu editor after
// import (this is the "modifier groups where the format allows" the plan
// calls for, not a full modifier builder).
export function menuImportTemplateCsv(): string {
  const rows = [
    MENU_IMPORT_HEADER,
    [
      "Coffee",
      "Flat White",
      "Double ristretto, steamed milk.",
      "5.00",
      "Milk",
      "popular",
      "yes",
      "Milk",
      "no",
      "1",
      "Full cream:0;Oat:0.50;Almond:0.50",
    ],
    [
      "Burgers",
      "Classic Beef",
      "Beef patty, cheese, lettuce, house sauce.",
      "18.50",
      "Gluten;Milk",
      "",
      "yes",
      "",
      "",
      "",
      "",
    ],
  ];
  return rows.map(toCsvRow).join("\n") + "\n";
}

// ---- Parsing / validation -----------------------------------------------------

export type ParsedItemRow = {
  rowNumber: number; // 1-based, counting the header as row 1
  category: string;
  name: string;
  description: string | null;
  priceCents: number;
  allergens: string[];
  badges: string[];
  available: boolean;
  modifierGroupName: string | null;
  modifierRequired: boolean;
  modifierMaxSelect: number;
  modifierOptions: { name: string; priceDeltaCents: number }[];
};

export type RowIssue = { rowNumber: number; message: string };

export type ParseResult = {
  rows: ParsedItemRow[];
  errors: RowIssue[]; // block the import
  warnings: RowIssue[]; // informational — value was dropped or defaulted
};

const ALLERGEN_BY_LOWER = new Map(ALLERGEN_OPTIONS.map((a) => [a.toLowerCase(), a]));
const BADGE_BY_LOWER = new Map(BADGE_VALUES.map((b) => [b.toLowerCase(), b]));

function splitList(s: string): string[] {
  return s
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseYesNo(s: string, fallback: boolean): boolean {
  const v = s.trim().toLowerCase();
  if (v === "") return fallback;
  return v === "yes" || v === "y" || v === "true" || v === "1";
}

export function parseMenuImportCsv(text: string): ParseResult {
  const table = parseCsv(text);
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const rows: ParsedItemRow[] = [];

  if (table.length === 0) {
    return { rows, errors: [{ rowNumber: 1, message: "The file is empty." }], warnings };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const idx = {
    category: col("Category"),
    name: col("Item Name"),
    description: col("Description"),
    price: col("Price"),
    allergens: col("Allergens"),
    badges: col("Badges"),
    available: col("Available"),
    modGroup: col("Modifier Group"),
    modRequired: col("Modifier Required"),
    modMax: col("Modifier Max Select"),
    modOptions: col("Modifier Options"),
  };
  if (idx.category === -1 || idx.name === -1 || idx.price === -1) {
    return {
      rows,
      errors: [
        {
          rowNumber: 1,
          message:
            'The header must include "Category", "Item Name" and "Price" (download the template to see the exact columns).',
        },
      ],
      warnings,
    };
  }

  const get = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");

  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const rowNumber = i + 1;
    if (r.every((f) => f.trim() === "")) continue; // blank line

    const category = get(r, idx.category);
    const name = get(r, idx.name);
    const priceStr = get(r, idx.price);

    if (!category) {
      errors.push({ rowNumber, message: "Missing category." });
      continue;
    }
    if (category.length > 60) {
      errors.push({ rowNumber, message: "Category name is too long (max 60 characters)." });
      continue;
    }
    if (!name) {
      errors.push({ rowNumber, message: "Missing item name." });
      continue;
    }
    if (name.length > 80) {
      errors.push({ rowNumber, message: "Item name is too long (max 80 characters)." });
      continue;
    }
    if (!priceStr) {
      errors.push({ rowNumber, message: "Missing price." });
      continue;
    }
    const priceCents = dollarsToCents(priceStr);
    if (priceCents === null) {
      errors.push({ rowNumber, message: `"${priceStr}" isn't a valid price, e.g. 12 or 12.50.` });
      continue;
    }

    const descriptionRaw = get(r, idx.description);
    const description = descriptionRaw ? descriptionRaw.slice(0, 240) : null;

    const allergensRaw = idx.allergens >= 0 ? splitList(get(r, idx.allergens)) : [];
    const allergens: string[] = [];
    for (const a of allergensRaw) {
      const match = ALLERGEN_BY_LOWER.get(a.toLowerCase());
      if (match) allergens.push(match);
      else warnings.push({ rowNumber, message: `Unrecognised allergen "${a}" was dropped.` });
    }

    const badgesRaw = idx.badges >= 0 ? splitList(get(r, idx.badges)) : [];
    const badges: string[] = [];
    for (const b of badgesRaw) {
      const match = BADGE_BY_LOWER.get(b.toLowerCase().replace(/\s+/g, "_"));
      if (match) badges.push(match);
      else warnings.push({ rowNumber, message: `Unrecognised badge "${b}" was dropped.` });
    }

    const available = idx.available >= 0 ? parseYesNo(get(r, idx.available), true) : true;

    const modifierGroupName = idx.modGroup >= 0 ? get(r, idx.modGroup) || null : null;
    let modifierRequired = false;
    let modifierMaxSelect = 1;
    let modifierOptions: { name: string; priceDeltaCents: number }[] = [];

    if (modifierGroupName) {
      if (modifierGroupName.length > 60) {
        errors.push({ rowNumber, message: "Modifier group name is too long (max 60 characters)." });
        continue;
      }
      modifierRequired = idx.modRequired >= 0 ? parseYesNo(get(r, idx.modRequired), false) : false;
      const maxStr = idx.modMax >= 0 ? get(r, idx.modMax) : "";
      const maxParsed = maxStr ? parseInt(maxStr, 10) : 1;
      modifierMaxSelect = Number.isInteger(maxParsed)
        ? Math.min(20, Math.max(0, maxParsed))
        : 1;

      const optionsRaw = idx.modOptions >= 0 ? get(r, idx.modOptions) : "";
      const optionEntries = optionsRaw
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean);
      let optionError = false;
      for (const entry of optionEntries) {
        const [optNameRaw, optPriceRaw] = entry.split(":");
        const optName = (optNameRaw ?? "").trim();
        if (!optName) continue;
        let priceDeltaCents = 0;
        if (optPriceRaw && optPriceRaw.trim()) {
          const parsedDelta = dollarsToCents(optPriceRaw.trim());
          if (parsedDelta === null) {
            errors.push({
              rowNumber,
              message: `"${entry}" in Modifier Options isn't a valid "Name:Price" pair.`,
            });
            optionError = true;
            break;
          }
          priceDeltaCents = parsedDelta;
        }
        modifierOptions.push({ name: optName.slice(0, 60), priceDeltaCents });
      }
      if (optionError) continue;
      if (modifierOptions.length === 0) {
        warnings.push({
          rowNumber,
          message: `Modifier group "${modifierGroupName}" has no options and will be skipped.`,
        });
      }
    }

    rows.push({
      rowNumber,
      category,
      name,
      description,
      priceCents,
      allergens,
      badges,
      available,
      modifierGroupName: modifierOptions.length > 0 ? modifierGroupName : null,
      modifierRequired,
      modifierMaxSelect,
      modifierOptions,
    });
  }

  return { rows, errors, warnings };
}

// ---- Preview -------------------------------------------------------------------

export type ImportPreviewItem = {
  rowNumber: number;
  name: string;
  priceCents: number;
  modifierGroupName: string | null;
  optionCount: number;
  alreadyExists: boolean;
};

export type ImportPreviewCategory = {
  name: string;
  isNew: boolean;
  items: ImportPreviewItem[];
};

export async function buildImportPreview(
  restaurantId: string,
  rows: ParsedItemRow[],
): Promise<ImportPreviewCategory[]> {
  const existing = await prisma.menuCategory.findMany({
    where: { restaurantId },
    select: { name: true, items: { select: { name: true } } },
  });
  const existingByLower = new Map(
    existing.map((c) => [c.name.trim().toLowerCase(), new Set(c.items.map((i) => i.name.trim().toLowerCase()))]),
  );

  const order: string[] = [];
  const byCategory = new Map<string, ParsedItemRow[]>();
  for (const row of rows) {
    const key = row.category.trim();
    if (!byCategory.has(key)) {
      byCategory.set(key, []);
      order.push(key);
    }
    byCategory.get(key)!.push(row);
  }

  return order.map((categoryName) => {
    const lower = categoryName.toLowerCase();
    const existingItems = existingByLower.get(lower);
    // Tracks names already seen in THIS file for this category too, so a
    // duplicate row within the upload itself previews as "will be skipped"
    // exactly like commitMenuImport treats it, rather than only catching
    // duplicates that already exist in the database.
    const seenInFile = new Set<string>();
    return {
      name: categoryName,
      isNew: !existingItems,
      items: byCategory.get(categoryName)!.map((row) => {
        const key = row.name.trim().toLowerCase();
        const alreadyExists = existingItems?.has(key) || seenInFile.has(key);
        seenInFile.add(key);
        return {
          rowNumber: row.rowNumber,
          name: row.name,
          priceCents: row.priceCents,
          modifierGroupName: row.modifierGroupName,
          optionCount: row.modifierOptions.length,
          alreadyExists,
        };
      }),
    };
  });
}

// ---- Whole-menu deletion -----------------------------------------------------
// Shared by commitMenuImport's "replace" mode (below) and the dashboard's
// standalone "delete whole menu" danger-zone action (dashboard/menu/actions.ts)
// — one deletion primitive, not duplicated. Always called from inside a
// transaction the CALLER owns (so replace-mode's delete-then-recreate is one
// atomic unit), never opens its own.
//
// A single `menuCategory.deleteMany` is enough: MenuCategory -> MenuItem ->
// ModifierGroup -> ModifierOption, and every Square catalog mapping table
// (MenuItemSquareMap, MenuCategorySquareMap, ModifierGroupSquareMap,
// ModifierOptionSquareMap), all cascade off their parent FK (see
// prisma/schema.prisma) — nothing is left orphaned. BillItem.menuItemId is
// the one deliberate exception: nullable with onDelete: SetNull, so a past
// order's line items keep their nameSnapshot/priceCents and simply lose the
// live link, rather than being deleted or blocking this delete.
export async function deleteAllMenuData(
  tx: Prisma.TransactionClient,
  restaurantId: string,
): Promise<{ categoriesDeleted: number; itemsDeleted: number }> {
  const [categoriesDeleted, itemsDeleted] = await Promise.all([
    tx.menuCategory.count({ where: { restaurantId } }),
    tx.menuItem.count({ where: { category: { restaurantId } } }),
  ]);
  await tx.menuCategory.deleteMany({ where: { restaurantId } });
  return { categoriesDeleted, itemsDeleted };
}

// ---- Commit ----------------------------------------------------------------

export type ImportCommitResult = {
  categoriesCreated: number;
  itemsCreated: number;
  itemsSkipped: number; // already existed in that category — never overwritten
  // Only nonzero in "replace" mode — see deleteAllMenuData above.
  categoriesDeleted: number;
  itemsDeleted: number;
};

// Idempotent in "add" mode: re-running the same file is safe. A category is
// matched or created by name (case-insensitive) so repeat imports land in the
// same categories rather than duplicating them; an item is matched by name
// within its category and, if found, is left completely untouched (never
// overwritten) and counted as skipped — only genuinely new items are created.
// Re-checks the DB fresh here rather than trusting whatever the caller
// previewed, since time may have passed between preview and confirm.
//
// "replace" mode deletes the ENTIRE existing menu (deleteAllMenuData) inside
// the same transaction, immediately before the create loop below — which
// then runs completely unchanged: with nothing left to match against,
// existingCategories/existingItemNames both start empty and every row is
// created fresh. No separate "replace" code path to keep in sync.
export async function commitMenuImport(
  restaurantId: string,
  rows: ParsedItemRow[],
  mode: "add" | "replace" = "add",
): Promise<ImportCommitResult> {
  let categoriesCreated = 0;
  let itemsCreated = 0;
  let itemsSkipped = 0;
  let categoriesDeleted = 0;
  let itemsDeleted = 0;

  await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      ({ categoriesDeleted, itemsDeleted } = await deleteAllMenuData(tx, restaurantId));
    }

    const existingCategories = await tx.menuCategory.findMany({
      where: { restaurantId },
      select: { id: true, name: true, sortOrder: true },
    });
    const categoryByLower = new Map(
      existingCategories.map((c) => [c.name.trim().toLowerCase(), c]),
    );
    let nextCategorySort =
      existingCategories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;

    const byCategory = new Map<string, ParsedItemRow[]>();
    for (const row of rows) {
      const key = row.category.trim();
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(row);
    }

    for (const [categoryName, categoryRows] of byCategory) {
      let category = categoryByLower.get(categoryName.toLowerCase());
      if (!category) {
        category = await tx.menuCategory.create({
          data: { restaurantId, name: categoryName, sortOrder: nextCategorySort++ },
          select: { id: true, name: true, sortOrder: true },
        });
        categoryByLower.set(categoryName.toLowerCase(), category);
        categoriesCreated++;
      }

      const existingItems = await tx.menuItem.findMany({
        where: { categoryId: category.id },
        select: { name: true, sortOrder: true },
      });
      const existingItemNames = new Set(existingItems.map((i) => i.name.trim().toLowerCase()));
      let nextItemSort =
        existingItems.reduce((max, i) => Math.max(max, i.sortOrder), -1) + 1;

      for (const row of categoryRows) {
        if (existingItemNames.has(row.name.trim().toLowerCase())) {
          itemsSkipped++;
          continue;
        }
        const item = await tx.menuItem.create({
          data: {
            categoryId: category.id,
            name: row.name,
            description: row.description,
            priceCents: row.priceCents,
            allergens: row.allergens,
            badges: row.badges,
            available: row.available,
            sortOrder: nextItemSort++,
          },
        });
        existingItemNames.add(row.name.trim().toLowerCase());
        itemsCreated++;

        if (row.modifierGroupName && row.modifierOptions.length > 0) {
          const group = await tx.modifierGroup.create({
            data: {
              menuItemId: item.id,
              name: row.modifierGroupName,
              required: row.modifierRequired,
              maxSelect: row.modifierMaxSelect,
              sortOrder: 0,
            },
          });
          await tx.modifierOption.createMany({
            data: row.modifierOptions.map((o, i) => ({
              groupId: group.id,
              name: o.name,
              priceDeltaCents: o.priceDeltaCents,
              sortOrder: i,
            })),
          });
        }
      }
    }
  }, { timeout: 15000 }); // replace mode's extra delete pass, plus a large CSV's
  // many sequential row-by-row creates, can both run past Prisma's 5s default.

  return { categoriesCreated, itemsCreated, itemsSkipped, categoriesDeleted, itemsDeleted };
}
