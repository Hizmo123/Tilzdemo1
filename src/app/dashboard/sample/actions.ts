"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { SAMPLE_MENU, SAMPLE_TABLES } from "@/lib/sample-data";

export type SampleResult = { error?: string; addedMenu?: boolean; addedTables?: boolean };

// Populates a realistic sample menu and set of tables so a new owner sees the
// product working immediately. Only fills what's empty: it won't duplicate a
// menu you've already started or tables you've already made.
export async function loadSampleData(): Promise<SampleResult> {
  const authz = await getAuthz();
  if (!authz.can("menu:manage") || !authz.can("tables:manage"))
    return { error: "You don't have permission to do that." };

  const restaurant = authz.membership?.organization.restaurants[0];
  const location = restaurant?.locations[0];
  if (!restaurant || !location) return { error: "Create your restaurant first." };

  const [existingCats, existingTables] = await Promise.all([
    prisma.menuCategory.count({ where: { restaurantId: restaurant.id } }),
    prisma.table.count({ where: { locationId: location.id } }),
  ]);

  const addMenu = existingCats === 0;
  const addTables = existingTables === 0;
  if (!addMenu && !addTables) {
    return {
      error:
        "Your menu and tables already have content — sample data only fills an empty venue.",
    };
  }

  await prisma.$transaction(async (tx) => {
    if (addMenu) {
      for (let ci = 0; ci < SAMPLE_MENU.length; ci++) {
        const cat = SAMPLE_MENU[ci];
        const category = await tx.menuCategory.create({
          data: { restaurantId: restaurant.id, name: cat.name, sortOrder: ci },
        });
        for (let ii = 0; ii < cat.items.length; ii++) {
          const item = cat.items[ii];
          const created = await tx.menuItem.create({
            data: {
              categoryId: category.id,
              name: item.name,
              description: item.description ?? null,
              priceCents: item.priceCents,
              sortOrder: ii,
            },
          });
          for (let gi = 0; gi < (item.groups?.length ?? 0); gi++) {
            const g = item.groups![gi];
            const group = await tx.modifierGroup.create({
              data: {
                menuItemId: created.id,
                name: g.name,
                required: g.required ?? false,
                maxSelect: g.maxSelect ?? 1,
                sortOrder: gi,
              },
            });
            for (let oi = 0; oi < g.options.length; oi++) {
              const o = g.options[oi];
              await tx.modifierOption.create({
                data: {
                  groupId: group.id,
                  name: o.name,
                  priceDeltaCents: o.deltaCents ?? 0,
                  sortOrder: oi,
                },
              });
            }
          }
        }
      }
    }

    if (addTables) {
      for (const t of SAMPLE_TABLES) {
        const table = await tx.table.create({
          data: { locationId: location.id, label: t.label, section: t.section },
        });
        await tx.qrToken.create({
          data: { token: generateToken(), tableId: table.id },
        });
      }
    }
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "restaurant.sample_loaded",
    metadata: { menu: addMenu, tables: addTables },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard/tables");
  return { addedMenu: addMenu, addedTables: addTables };
}
