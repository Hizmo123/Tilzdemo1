"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { SAMPLE_MENU } from "@/lib/sample-data";
import { sameEveryDayHours, weekdayWeekendHours } from "@/lib/hours";
import { getSetupChecklist, type ChecklistItem } from "@/lib/setup-checklist";
import { entitlementsForTier } from "@/lib/entitlements";
import {
  createServiceClient,
  ensurePublicBucket,
  MENU_IMAGE_BUCKET,
  StorageNotConfiguredError,
} from "@/lib/supabase/service";
import {
  VENUE_TYPES,
  SERVICE_STYLES,
  SPLIT_METHOD_VALUES,
  type OnboardingAnswers,
  type OnboardingDraftPayload,
} from "@/lib/onboarding-options";
// Constants live in a plain module — a "use server" file may only export async
// functions, so exporting arrays from here breaks them at runtime (see
// dashboard/settings/constants.ts).
import { CURRENCIES, TIMEZONES, THEMES } from "@/app/dashboard/settings/constants";
import { COUNTRIES } from "@/lib/countries";
import { LANGUAGE_CODES } from "@/lib/languages";

export type OnboardingState = { error?: string; ok?: boolean; checklist?: ChecklistItem[] };

const timeString = z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM.");

const schema = z.object({
  country: z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]]),
  language: z.enum(LANGUAGE_CODES),
  restaurantName: z.string().trim().min(2, "Enter your venue's name.").max(80),
  venueType: z.enum(VENUE_TYPES.map((v) => v.value) as [string, ...string[]]),
  serviceStyle: z
    .enum(SERVICE_STYLES.map((v) => v.value) as [string, ...string[]])
    .nullable(),
  experienceMode: z.string().min(1).max(40),
  customerOrdering: z.boolean(),
  customerPayment: z.boolean(),
  paymentTiming: z.enum(["before", "after"]),
  staffApproval: z.boolean(),
  tableCount: z.number().int().min(0).max(200),
  hoursMode: z.enum(["same", "weekday_weekend", "later"]),
  hoursWeekday: z.object({ open: timeString, close: timeString }),
  hoursWeekend: z.object({ open: timeString, close: timeString }),
  menuPeriods: z.boolean(),
  menuStations: z.boolean(),
  sampleMenu: z.boolean(),
  splitMethods: z.array(z.enum(SPLIT_METHOD_VALUES)).min(1),
  tipEnabled: z.boolean(),
  tipPresets: z.array(z.number().int().min(1).max(100)).max(5),
  theme: z.enum(THEMES),
  themeMode: z.enum(["light", "dark"]),
  fontTheme: z.enum(["classic", "elegant", "modern"]),
  cornerStyle: z.enum(["sharp", "soft", "round"]),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour.")
    .optional()
    .or(z.literal("")),
  tagline: z.string().trim().max(80).optional().or(z.literal("")),
  logoUrl: z.string().url().nullable().optional(),
  abn: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "ABN must be 11 digits.")
    .optional(),
  currency: z.enum(CURRENCIES),
  timezone: z.enum(TIMEZONES),
  kitchenChime: z.boolean(),
  orderReadySmsEnabled: z.boolean(),
  posProvider: z.enum(["square", "none"]).nullable(),
  posProviderOther: z.string().trim().max(60).optional().or(z.literal("")),
  squareConnectInterest: z.boolean(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

// Sample-menu categories don't natively carry a station or a service window —
// this maps the wizard's step 6 answers onto them with a simple heuristic
// rather than hardcoding either. Reused by completeOnboarding only.
function stationFor(categoryName: string): string | null {
  const n = categoryName.toLowerCase();
  if (n.includes("coffee")) return "Coffee";
  if (n.includes("bar") || n.includes("drink")) return "Bar";
  return "Kitchen";
}
function windowFor(categoryName: string): { from: string | null; to: string | null } {
  const n = categoryName.toLowerCase();
  if (n.includes("coffee")) return { from: "07:00", to: "11:30" };
  if (n.includes("sweet") || n.includes("dessert")) return { from: null, to: null };
  return { from: "11:00", to: "21:00" };
}

// Autosaves the in-progress wizard so a refresh resumes with every selection
// intact. Keyed by the Supabase user id because no Restaurant/Organization row
// exists until completeOnboarding runs. A no-op for anyone who already has a
// venue (nothing left to resume).
export async function saveOnboardingDraft(
  payload: OnboardingDraftPayload,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  const existing = await prisma.membership.findFirst({ where: { userId: user.id } });
  if (existing) return { ok: true };

  await prisma.onboardingDraft.upsert({
    where: { userId: user.id },
    create: { userId: user.id, answers: payload as unknown as Prisma.InputJsonValue },
    update: { answers: payload as unknown as Prisma.InputJsonValue },
  });
  return { ok: true };
}

// Uploads a logo before any Restaurant exists, so it can't reuse
// dashboard/settings/actions.ts's uploadLogo (which writes straight to a
// restaurant row). Same storage, same compression pipeline, same public-URL
// shape — just pathed under the user id and returned rather than persisted,
// so the wizard can hold it in its draft until completeOnboarding.
export async function uploadOnboardingLogo(
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No image received." };
  if (file.size > 3 * 1024 * 1024) return { error: "Image is too large." };
  if (!file.type.startsWith("image/")) return { error: "That isn't an image." };

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) return { error: e.message };
    return { error: "Couldn't reach image storage. Please try again." };
  }

  await ensurePublicBucket(supabase, MENU_IMAGE_BUCKET);

  const path = `onboarding/${user.id}/logo-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { data: pub } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl };
}

// Creates the whole venue from the wizard's answers in one transaction:
// organization + owner membership + restaurant (with every service/appearance
// setting) + a location + N tables with QR codes + an optional sample menu —
// then clears the draft. Atomic: nothing is written unguarded.
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

  const hours =
    a.hoursMode === "later"
      ? null
      : a.hoursMode === "same"
        ? sameEveryDayHours(a.hoursWeekday.open, a.hoursWeekday.close)
        : weekdayWeekendHours(
            a.hoursWeekday.open,
            a.hoursWeekday.close,
            a.hoursWeekend.open,
            a.hoursWeekend.close,
          );

  // Globally-unique slug with a short suffix on collision.
  const base = slugify(a.restaurantName) || "venue";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.restaurant.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { organizationId, restaurant } = await prisma.$transaction(async (tx) => {
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
        serviceStyle: a.serviceStyle,
        experienceMode: a.experienceMode,
        theme: a.theme,
        themeMode: a.themeMode,
        fontTheme: a.fontTheme,
        cornerStyle: a.cornerStyle,
        brandColor: a.brandColor ? a.brandColor : null,
        tagline: a.tagline ? a.tagline : null,
        logoUrl: a.logoUrl ?? null,
        tipEnabled: a.tipEnabled,
        tipPresets: a.tipPresets.length ? a.tipPresets : [5, 10, 15],
        customerOrdering: a.customerOrdering,
        customerPayment: a.customerPayment,
        staffApproval: a.staffApproval,
        paymentTiming: a.paymentTiming,
        splitMethods: a.splitMethods,
        kitchenChime: a.kitchenChime,
        orderReadySmsEnabled: a.orderReadySmsEnabled,
        currency: a.currency,
        timezone: a.timezone,
        country: a.country,
        language: a.language,
        hours: hours === null ? Prisma.JsonNull : (hours as Prisma.InputJsonValue),
        posProvider: a.posProvider,
        posProviderOther: a.posProviderOther ? a.posProviderOther : null,
        squareConnectInterest: a.squareConnectInterest,
        onboardingCompletedAt: new Date(),
        locations: { create: { name: "Main" } },
      },
      include: { locations: true },
    });
    const location = restaurant.locations[0];

    // Tables 1..N with QR tokens, in two round trips instead of N. A brand
    // new organisation always starts on FREE (Organization.plan's default),
    // so its table cap applies from the very first setup — the wizard's own
    // table-count step doesn't reflect this cap in its UI yet (a real
    // follow-up), but the account can't silently end up over the limit it's
    // about to be told it has.
    const freeTableLimit = entitlementsForTier("FREE").tableLimit ?? a.tableCount;
    const tableCount = Math.min(a.tableCount, freeTableLimit);
    if (tableCount > 0) {
      const created = await tx.table.createManyAndReturn({
        data: Array.from({ length: tableCount }, (_, i) => ({
          locationId: location.id,
          label: String(i + 1),
        })),
      });
      await tx.qrToken.createMany({
        data: created.map((t) => ({ token: generateToken(), tableId: t.id })),
      });
    }

    // Optional starter menu the owner can then edit, seeded per step 6.
    if (a.sampleMenu) {
      for (let ci = 0; ci < SAMPLE_MENU.length; ci++) {
        const cat = SAMPLE_MENU[ci];
        const win = a.menuPeriods ? windowFor(cat.name) : { from: null, to: null };
        const category = await tx.menuCategory.create({
          data: {
            restaurantId: restaurant.id,
            name: cat.name,
            sortOrder: ci,
            availableFrom: win.from,
            availableTo: win.to,
            station: a.menuStations ? stationFor(cat.name) : null,
          },
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

    // The draft's only job was surviving a mid-wizard refresh — done now.
    await tx.onboardingDraft.deleteMany({ where: { userId: user.id } });

    return { organizationId: org.id, restaurant };
  });

  await audit({
    organizationId,
    actorUserId: user.id,
    actorEmail: user.email ?? "",
    action: "restaurant.onboarded",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
    metadata: {
      venueType: a.venueType,
      experienceMode: a.experienceMode,
      tables: a.tableCount,
      sampleMenu: a.sampleMenu,
    },
  });

  const checklist = await getSetupChecklist(restaurant);

  revalidatePath("/dashboard");
  return { ok: true, checklist };
}
