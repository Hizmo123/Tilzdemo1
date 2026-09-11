"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { SAMPLE_MENU } from "@/lib/sample-data";

export type OnboardingState = { error?: string; ok?: boolean };

const VENUE_TYPES = [
  "cafe",
  "restaurant",
  "bar",
  "bakery",
  "food_truck",
  "other",
] as const;

const schema = z.object({
  restaurantName: z.string().trim().min(2, "Enter your venue's name.").max(80),
  venueType: z.enum(VENUE_TYPES),
  customerOrdering: z.boolean(),
  customerPayment: z.boolean(),
  staffApproval: z.boolean(),
  paymentTiming: z.enum(["before", "after"]),
  takeawayEnabled: z.boolean(),
  tipEnabled: z.boolean(),
  theme: z.enum(["warm", "minimal", "fresh", "bold"]),
  themeMode: z.enum(["light", "dark"]),
  abn: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "ABN must be 11 digits.")
    .optional(),
  tableCount: z.number().int().min(0).max(50),
  sampleMenu: z.boolean(),
});

export type OnboardingAnswers = {
  restaurantName: string;
  venueType: string;
  customerOrdering: boolean;
  customerPayment: boolean;
  staffApproval: boolean;
  paymentTiming: "before" | "after";
  takeawayEnabled: boolean;
  tipEnabled: boolean;
  theme: "warm" | "minimal" | "fresh" | "bold";
  themeMode: "light" | "dark";
  abn: string;
  tableCount: number;
  sampleMenu: boolean;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

// Creates the whole venue from the signup wizard's answers in one transaction:
// organization + owner membership + restaurant (with its appearance/service
// settings) + a location + N tables with QR codes + an optional sample menu.
export async function completeOnboarding(
  answers: OnboardingAnswers,
): Promise<OnboardingState> {
  const user = await requireUser();

  // Guard: one venue per account through this flow. If they already have a
  // membership, onboarding is done — don't create a duplicate.
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id },
  });
  if (existing) return { error: "Your venue is already set up." };

  const parsed = schema.safeParse(answers);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const a = parsed.data;

  // Globally-unique slug with a short suffix on collision.
  const base = slugify(a.restaurantName) || "venue";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.restaurant.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const organizationId = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: a.restaurantName } });

    await tx.membership.create({
      data: {
        userId: user.id,
        email: user.email ?? "",
        organizationId: org.id,
        role: "OWNER",
      },
    });

    const restaurant = await tx.restaurant.create({
      data: {
        organizationId: org.id,
        name: a.restaurantName,
        slug,
        abn: a.abn ? a.abn : null,
        venueType: a.venueType,
        theme: a.theme,
        themeMode: a.themeMode,
        tipEnabled: a.tipEnabled,
        customerOrdering: a.customerOrdering,
        customerPayment: a.customerPayment,
        staffApproval: a.staffApproval,
        paymentTiming: a.paymentTiming,
        takeawayEnabled: a.takeawayEnabled,
        locations: { create: { name: "Main" } },
      },
      include: { locations: true },
    });
    const location = restaurant.locations[0];

    // Tables 1..N, each with a QR token.
    for (let i = 1; i <= a.tableCount; i++) {
      const table = await tx.table.create({
        data: { locationId: location.id, label: String(i) },
      });
      await tx.qrToken.create({
        data: { token: generateToken(), tableId: table.id },
      });
    }

    // Optional starter menu the owner can then edit.
    if (a.sampleMenu) {
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

    return org.id;
  });

  await audit({
    organizationId,
    actorUserId: user.id,
    actorEmail: user.email ?? "",
    action: "restaurant.onboarded",
    resourceType: "Restaurant",
    metadata: {
      venueType: a.venueType,
      tables: a.tableCount,
      sampleMenu: a.sampleMenu,
    },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
