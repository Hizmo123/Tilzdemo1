"use server";

import { randomBytes, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser, ACTIVE_VENUE_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { SAMPLE_MENU } from "@/lib/sample-data";
import { sameEveryDayHours, weekdayWeekendHours } from "@/lib/hours";
import { getSetupChecklist, type ChecklistItem } from "@/lib/setup-checklist";
import { entitlementsForTier, getEntitlements, canCreateVenue } from "@/lib/entitlements";
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

// Shared by completeOnboarding (new org) and completeOnboardingForExistingOrg
// (task G's "+ Add venue" flow, attaching to an ALREADY-existing org): builds
// the restaurant (every service/appearance setting from the wizard) + its
// location + N tables with QR codes + an optional sample menu, inside the
// caller's transaction. Not itself exported — a "use server" file may only
// export async functions meant to be called as server actions, and this is
// an internal helper, not a directly-invokable one.
//
// tableLimit is passed in rather than computed here because the two callers
// need genuinely different tiers: a brand-new org always starts on LITE
// (tableLimit 0), but an ADDED venue lives under an org that's already on
// whatever tier let it add a second venue at all (PRO, per
// canCreateVenue — see completeOnboardingForExistingOrg), which has its own,
// much higher table limit. Hardcoding LITE here would have wrongly capped
// an added Pro venue at zero tables.
async function createRestaurantAndSeedFromAnswers(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  a: z.infer<typeof schema>,
  hours: ReturnType<typeof sameEveryDayHours> | null,
  slug: string,
  tableLimit: number | null,
) {
  const restaurant = await tx.restaurant.create({
    data: {
      organizationId,
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
      currency: a.currency,
      timezone: a.timezone,
      country: a.country,
      language: a.language,
      hours: hours === null ? Prisma.JsonNull : (hours as Prisma.InputJsonValue),
      onboardingCompletedAt: new Date(),
      locations: { create: { name: "Main" } },
    },
    include: { locations: true },
  });
  const location = restaurant.locations[0];

  // Tables 1..N with QR tokens, in two round trips instead of N. Clamped to
  // this org's actual table limit so the account can't silently end up with
  // more tables than its plan includes.
  const cappedTableLimit = tableLimit ?? a.tableCount;
  const tableCount = Math.min(a.tableCount, cappedTableLimit);
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
  await tx.onboardingDraft.deleteMany({ where: { userId } });

  return restaurant;
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

    // A brand new organisation always starts on LITE (Organization.plan's
    // default), whose tableLimit is 0 — LITE is menu-only, no live ordering
    // at all — so this clamp uses LITE's limit specifically, not whatever
    // tier happens to exist (there isn't one yet). See
    // completeOnboardingForExistingOrg for why an ADDED venue clamps
    // against the org's actual current tier instead.
    const restaurant = await createRestaurantAndSeedFromAnswers(
      tx,
      org.id,
      user.id,
      a,
      hours,
      slug,
      entitlementsForTier("LITE").tableLimit,
    );

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

// Task G's "+ Add venue" flow: reuses the SAME wizard UI/answers shape as
// completeOnboarding, but attaches the new restaurant to an EXISTING
// organisation instead of creating a new org + membership. Called from
// OnboardingWizard when it's rendered with an organizationId prop (see
// onboarding-wizard.tsx) — /venues/new is the only page that does that.
export async function completeOnboardingForExistingOrg(
  organizationId: string,
  answers: OnboardingAnswers,
): Promise<OnboardingState> {
  const user = await requireUser();

  // Ownership check: never trust an organizationId handed back from the
  // client without confirming the caller actually belongs to it.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId },
  });
  if (!membership) return { error: "You don't have access to that organisation." };

  // The real gate for this whole task: re-checked here, server-side,
  // regardless of what confirmation screen the client showed —
  // canCreateVenue is the single source of truth (lib/entitlements.ts).
  const check = await canCreateVenue(organizationId);
  if (!check.allowed) return { error: check.reason };

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

  const base = slugify(a.restaurantName) || "venue";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.restaurant.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Unlike a brand-new org (always LITE), this org is already on whatever
  // tier let it reach canCreateVenue's allowed:true past its first venue —
  // in practice always PRO today, since every other tier hard-blocks a 2nd
  // venue outright. Its table limit, not LITE's, is what a newly ADDED
  // venue should be clamped to.
  const ent = await getEntitlements(organizationId);

  let restaurant;
  try {
    restaurant = await prisma.$transaction(
      (tx) =>
        createRestaurantAndSeedFromAnswers(tx, organizationId, user.id, a, hours, slug, ent.tableLimit),
      { timeout: 15000 },
    );
  } catch (e) {
    log.error("onboarding.add_venue_failed", {
      userId: user.id,
      organizationId,
      message: e instanceof Error ? e.message : String(e),
    });
    return { error: "Something went wrong creating your venue. Please try again." };
  }

  await audit({
    organizationId,
    actorUserId: user.id,
    actorEmail: user.email ?? "",
    action: "restaurant.added",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
    metadata: {
      venueType: a.venueType,
      tables: a.tableCount,
      requiresPayment: "requiresPayment" in check ? check.requiresPayment : false,
    },
  });

  // Make the just-created venue the active one immediately (task G.2) —
  // same cookie lib/auth.ts#getTenantContext reads, set directly here
  // rather than via a second setActiveVenue call, since we already know
  // this id is valid (we just created it under this exact org).
  const jar = await cookies();
  jar.set(ACTIVE_VENUE_COOKIE, restaurant.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  const checklist = await getSetupChecklist(restaurant);

  revalidatePath("/dashboard");
  revalidatePath("/venues");
  return { ok: true, checklist };
}
