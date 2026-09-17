"use server";

import { randomBytes, randomUUID } from "crypto";
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
import { log } from "@/lib/log";
import {
  createServiceClient,
  ensurePublicBucket,
  describeStorageError,
  MENU_IMAGE_BUCKET,
  StorageNotConfiguredError,
} from "@/lib/supabase/service";
import {
  VENUE_TYPES,
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

  try {
    await ensurePublicBucket(supabase, MENU_IMAGE_BUCKET);
  } catch (e) {
    log.error("onboarding.logo_bucket_failed", {
      userId: user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    return { error: "Couldn't prepare image storage. Please try again." };
  }

  const path = `onboarding/${user.id}/logo-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) {
    log.error("onboarding.logo_upload_failed", { userId: user.id, message: upErr.message });
    return { error: describeStorageError(upErr.message) };
  }

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

  let txResult;
  try {
    txResult = await prisma.$transaction(async (tx) => {
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
    //
    // This used to be one `await tx.X.create()` per category/item/group/option
    // — ~39 sequential round trips for the default sample menu alone, all
    // inside one interactive transaction. Against a database that isn't
    // co-located with the app server (see the region note elsewhere in this
    // codebase — every round trip here costs ~150-250ms), that regularly blew
    // past Prisma's 5s transaction timeout and failed the ENTIRE onboarding
    // transaction, surfacing as "Something went wrong creating your venue"
    // with no indication why. IDs are generated client-side so every level
    // can be inserted with one `createMany` instead of one round trip per row
    // — 4 batched calls total, regardless of menu size.
    if (a.sampleMenu) {
      const categoryRows = SAMPLE_MENU.map((cat, ci) => {
        const win = a.menuPeriods ? windowFor(cat.name) : { from: null, to: null };
        return {
          id: randomUUID(),
          restaurantId: restaurant.id,
          name: cat.name,
          sortOrder: ci,
          availableFrom: win.from,
          availableTo: win.to,
          station: a.menuStations ? stationFor(cat.name) : null,
        };
      });

      const itemRows: {
        id: string;
        categoryId: string;
        name: string;
        description: string | null;
        priceCents: number;
        sortOrder: number;
      }[] = [];
      const groupRows: {
        id: string;
        menuItemId: string;
        name: string;
        required: boolean;
        maxSelect: number;
        sortOrder: number;
      }[] = [];
      const optionRows: {
        id: string;
        groupId: string;
        name: string;
        priceDeltaCents: number;
        sortOrder: number;
      }[] = [];

      SAMPLE_MENU.forEach((cat, ci) => {
        const categoryId = categoryRows[ci].id;
        cat.items.forEach((item, ii) => {
          const itemId = randomUUID();
          itemRows.push({
            id: itemId,
            categoryId,
            name: item.name,
            description: item.description ?? null,
            priceCents: item.priceCents,
            sortOrder: ii,
          });
          (item.groups ?? []).forEach((g, gi) => {
            const groupId = randomUUID();
            groupRows.push({
              id: groupId,
              menuItemId: itemId,
              name: g.name,
              required: g.required ?? false,
              maxSelect: g.maxSelect ?? 1,
              sortOrder: gi,
            });
            g.options.forEach((o, oi) => {
              optionRows.push({
                id: randomUUID(),
                groupId,
                name: o.name,
                priceDeltaCents: o.deltaCents ?? 0,
                sortOrder: oi,
              });
            });
          });
        });
      });

      await tx.menuCategory.createMany({ data: categoryRows });
      if (itemRows.length) await tx.menuItem.createMany({ data: itemRows });
      if (groupRows.length) await tx.modifierGroup.createMany({ data: groupRows });
      if (optionRows.length) await tx.modifierOption.createMany({ data: optionRows });
    }

    // The draft's only job was surviving a mid-wizard refresh — done now.
    await tx.onboardingDraft.deleteMany({ where: { userId: user.id } });

    return { organizationId: org.id, restaurant };
  }, { timeout: 15000 });
  } catch (e) {
    // Whatever actually broke here — a timed-out transaction, a constraint
    // violation, a dropped connection — Next.js strips the real error before
    // it reaches the client (correctly, to avoid leaking internals), which
    // is exactly why this used to be a dead end to debug: the owner saw a
    // generic message and there was no server-side trace of what happened.
    log.error("onboarding.complete_failed", {
      userId: user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    return { error: "Something went wrong creating your venue. Please try again." };
  }
  const { organizationId, restaurant } = txResult;

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
