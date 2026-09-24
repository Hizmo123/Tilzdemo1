"use server";

import { randomBytes, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUser, getTenantContext, ACTIVE_VENUE_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { SAMPLE_MENU } from "@/lib/sample-data";
import { sameEveryDayHours, weekdayWeekendHours } from "@/lib/hours";
import { getSetupChecklist, type ChecklistItem } from "@/lib/setup-checklist";
import { entitlementsForTier, getEntitlements, canCreateVenue, type Entitlements } from "@/lib/entitlements";
import { mockSubscriptionData } from "@/lib/plan-subscription";
import {
  attachPendingToRestaurant,
  discardPending,
  getPendingSquareSummary,
  listPendingLocations,
  setPendingLocation,
  copyOrgConnectionToPending,
  type PendingSquareSummary,
} from "@/lib/square/pending";
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
  PLAN_TIER_VALUES,
  EXPERIENCE_MODES,
  isFullyStaffedMode,
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
  // Defaults, not required: a draft saved before these steps existed must
  // still complete (see defaultOnboardingAnswers for why BASIC).
  plan: z.enum(PLAN_TIER_VALUES).default("BASIC"),
  paymentPath: z.enum(["square", "tillz"]).default("tillz"),
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
  coverUrl: z.string().url().nullable().optional(),
  menuLayout: z.enum(["list", "grid", "magazine", "minimal"]).default("list"),
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
function stationFor(categoryName: string): string {
  const n = categoryName.toLowerCase();
  if (n.includes("coffee")) return "Coffee";
  if (n.includes("bar") || n.includes("drink")) return "Bar";
  return "Kitchen";
}

// The venue's prep stations (Restaurant.kitchenStations — what the category/
// item station pickers offer). "Kitchen + bar + coffee" used to route the
// SAMPLE categories to those names without ever adding them to this list,
// so the pickers never showed them. Clamped to the tier's KDS station limit
// (Basic = 2) the same way canCreateStation would refuse a third later.
function stationsFor(a: z.infer<typeof schema>, kdsStationLimit: number | null): string[] {
  const wanted = a.menuStations ? ["Kitchen", "Bar", "Coffee"] : ["Kitchen"];
  const limit = kdsStationLimit === null ? wanted.length : Math.max(1, kdsStationLimit);
  return wanted.slice(0, limit);
}
function windowFor(categoryName: string): { from: string | null; to: string | null } {
  const n = categoryName.toLowerCase();
  if (n.includes("coffee")) return { from: "07:00", to: "11:30" };
  if (n.includes("sweet") || n.includes("dessert")) return { from: null, to: null };
  return { from: "11:00", to: "21:00" };
}

// Autosaves the in-progress wizard so a refresh resumes with every selection
// intact. Keyed by the Supabase user id because no Restaurant/Organization row
// exists until completeOnboarding runs. Also used by the "+ Add venue" flow
// (an existing member adding a second venue) — it needs the same resume
// behaviour, in particular across the Square OAuth round trip, which leaves
// the wizard and comes back. The draft is deleted by whichever completion
// action finishes it.
export async function saveOnboardingDraft(
  payload: OnboardingDraftPayload,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();

  await prisma.onboardingDraft.upsert({
    where: { userId: user.id },
    create: { userId: user.id, answers: payload as unknown as Prisma.InputJsonValue },
    update: { answers: payload as unknown as Prisma.InputJsonValue },
  });
  return { ok: true };
}

// Uploads a venue image (logo or cover/hero photo) before any Restaurant
// exists, so it can't reuse dashboard/settings/actions.ts's uploadLogo /
// uploadCover (which write straight to a restaurant row). Same storage,
// same compression pipeline, same public-URL shape — just pathed under the
// user id and returned rather than persisted, so the wizard can hold it in
// its draft until completeOnboarding.
export async function uploadOnboardingImage(
  formData: FormData,
  kind: "logo" | "cover",
): Promise<{ url: string } | { error: string }> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No image received." };
  if (file.size > 4 * 1024 * 1024) return { error: "Image is too large." };
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

  const path = `onboarding/${user.id}/${kind}-${randomBytes(6).toString("hex")}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (upErr) {
    log.error("onboarding.image_upload_failed", { userId: user.id, kind, message: upErr.message });
    return { error: describeStorageError(upErr.message) };
  }

  const { data: pub } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl };
}

// ---- Square during onboarding --------------------------------------------
// The wizard's Payments step. The OAuth round trip itself is
// /api/square/authorize?flow=onboarding → Square → /api/square/callback,
// which parks the tokens in PendingSquareConnection; these actions are how
// the wizard reads/steers that pending row. Nothing here ever returns token
// material (see lib/square/pending.ts).

export async function getPendingSquare(): Promise<PendingSquareSummary | null> {
  const user = await requireUser();
  return getPendingSquareSummary(user.id);
}

export async function listPendingSquareLocations(): Promise<{ id: string; name: string }[]> {
  const user = await requireUser();
  try {
    return await listPendingLocations(user.id);
  } catch (e) {
    log.error("onboarding.square_locations_failed", {
      userId: user.id,
      message: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

export async function setPendingSquareLocation(locationId: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireUser();
  if (!locationId) return { error: "Choose a location." };
  await setPendingLocation(user.id, locationId);
  return { ok: true };
}

export async function discardPendingSquare(): Promise<{ ok: true }> {
  const user = await requireUser();
  await discardPending(user.id);
  return { ok: true };
}

// +Add venue only (task 5): the org already has a working SquareConnection
// on some OTHER restaurant — reuse it instead of a fresh OAuth click-
// through. organizationId is resolved from the CALLER's own membership via
// getTenantContext, never trusted from the client, so this can only ever
// reuse a connection the signed-in user's own org actually owns.
export async function reuseOrgSquareConnection(): Promise<PendingSquareSummary | { error: string }> {
  const { user, membership } = await getTenantContext();
  if (!membership) return { error: "No organisation found." };

  const result = await copyOrgConnectionToPending(user.id, membership.organizationId);
  if (!result) return { error: "No existing Square connection found for this organisation." };
  return result;
}

// Lite is menu-only: whatever the experience step said (or a stale draft
// carried), the persisted venue can't have ordering or payment on. Applied
// server-side so the client's step-skipping is a convenience, not the guard.
function forceMenuOnly(a: z.infer<typeof schema>): z.infer<typeof schema> {
  return {
    ...a,
    experienceMode: "digital_menu",
    ...EXPERIENCE_MODES.digital_menu.settings,
    paymentPath: "tillz",
  };
}

// The server-side half of "Connect Square is mandatory" — the client
// (wizard/PaymentsStep) blocks Next/finish without a connected + located
// PendingSquareConnection, but that's only a convenience; this is the real
// gate. Returns an error string to fail the whole completion with (never
// silently falls back to another tier or lets the venue through menu-only —
// the caller must return this error as-is, not swallow it). Not pulled into
// forceMenuOnly's pattern since that one *adjusts* the answers and proceeds;
// this one can only block.
async function requireSquareForConnect(userId: string, tier: Entitlements): Promise<string | null> {
  if (!tier.requiresSquare) return null;
  const pending = await getPendingSquareSummary(userId);
  if (!pending || !pending.locationId) {
    return "Connect your Square account and choose a location before finishing — required on the Connect plan.";
  }
  return null;
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
  kdsStationLimit: number | null,
) {
  const stations = stationsFor(a, kdsStationLimit);
  // Fully staffed (staff take orders AND handle payment) means no customer
  // ever scans a table QR — re-derived from the actual answers here, not
  // from which wizard steps were shown, so a stale tableCount left over
  // from a draft (or a `fixedPlan` skip of the plan step) can't cause N
  // per-table codes to be minted for a venue that will never use them.
  const fullyStaffed = isFullyStaffedMode(a.customerOrdering, a.customerPayment);
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
      coverUrl: a.coverUrl ?? null,
      menuLayout: a.menuLayout,
      kitchenStations: stations,
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
      // Nothing to lose on a fresh venue — no confirmation needed the way
      // Settings -> Service requires for an EXISTING venue with tables
      // already printed (see updateVenueSetup).
      useSharedQr: fullyStaffed,
    },
    include: { locations: true },
  });
  const location = restaurant.locations[0];

  // Tables 1..N with QR tokens, in two round trips instead of N. Clamped to
  // this org's actual table limit so the account can't silently end up with
  // more tables than its plan includes. Zero when fully staffed — this
  // venue gets ONE shared QR (Restaurant.useSharedQr above), not per-table
  // codes nobody will scan.
  const cappedTableLimit = tableLimit ?? a.tableCount;
  const tableCount = fullyStaffed ? 0 : Math.min(a.tableCount, cappedTableLimit);
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
        // Only route to a station the venue actually has (the tier clamp
        // above may have dropped "Coffee"); anything else falls back to
        // the kitchen rather than naming a station the pickers don't list.
        station: a.menuStations
          ? stations.includes(stationFor(cat.name))
            ? stationFor(cat.name)
            : "Kitchen"
          : null,
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

  // Square, if they connected it in the Payments step: the pending row
  // becomes this restaurant's real SquareConnection. (A pending row left
  // behind after they switched back to Tillz payments was already revoked
  // and dropped by the caller before this transaction started.)
  const square =
    a.paymentPath === "square" ? await attachPendingToRestaurant(tx, userId, restaurant.id) : null;

  // The draft's only job was surviving a mid-wizard refresh — done now.
  await tx.onboardingDraft.deleteMany({ where: { userId } });

  return { restaurant, square };
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
  const tier = entitlementsForTier(parsed.data.plan);
  const a = tier.ordering ? parsed.data : forceMenuOnly(parsed.data);

  const squareError = await requireSquareForConnect(user.id, tier);
  if (squareError) return { error: squareError };

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

  // They connected Square at some point but finished on Tillz payments:
  // revoke + drop the parked tokens rather than leave them lying around.
  if (a.paymentPath !== "square") await discardPending(user.id);

  let txResult;
  try {
    txResult = await prisma.$transaction(async (tx) => {
    // The plan chosen in the wizard is applied at creation — the same mock
    // "active" subscription the Billing page's switcher writes — so a new
    // venue can publish straight away instead of first detouring through
    // Billing to confirm a plan it already picked.
    const org = await tx.organization.create({
      data: { name: a.restaurantName, ...mockSubscriptionData(a.plan) },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        email: user.email ?? "",
        organizationId: org.id,
        role: "OWNER",
      },
    });

    // Table clamp uses the tier they just chose (Lite = 0: menu-only). See
    // completeOnboardingForExistingOrg for why an ADDED venue clamps
    // against the org's actual current tier instead.
    const { restaurant, square } = await createRestaurantAndSeedFromAnswers(
      tx,
      org.id,
      user.id,
      a,
      hours,
      slug,
      tier.tableLimit,
      tier.kdsStationLimit,
    );

    return { organizationId: org.id, restaurant, square };
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
  const { organizationId, restaurant, square } = txResult;

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
      plan: a.plan,
      paymentPath: a.paymentPath,
      tables: a.tableCount,
      sampleMenu: a.sampleMenu,
    },
  });
  await audit({
    organizationId,
    actorUserId: user.id,
    actorEmail: user.email ?? "",
    action: "billing.subscribed",
    metadata: { plan: a.plan, via: "onboarding" },
  });
  if (square) {
    await audit({
      organizationId,
      actorUserId: user.id,
      actorEmail: user.email ?? "",
      action: "square.connected",
      resourceType: "Restaurant",
      resourceId: restaurant.id,
      metadata: { ...square, via: "onboarding" },
    });
  }

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

  // Unlike a brand-new org, this org is already on whatever tier let it
  // reach canCreateVenue's allowed:true past its first venue — in practice
  // always PRO today, since every other tier hard-blocks a 2nd venue
  // outright. Its tier — not the wizard's (skipped) plan answer — decides
  // both the table clamp and whether ordering exists for the new venue.
  const ent = await getEntitlements(organizationId);
  const a = ent.ordering ? parsed.data : forceMenuOnly(parsed.data);

  const squareError = await requireSquareForConnect(user.id, ent);
  if (squareError) return { error: squareError };

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

  if (a.paymentPath !== "square") await discardPending(user.id);

  let restaurant;
  let square: { merchantId: string; environment: string } | null = null;
  try {
    const result = await prisma.$transaction(
      (tx) =>
        createRestaurantAndSeedFromAnswers(
          tx,
          organizationId,
          user.id,
          a,
          hours,
          slug,
          ent.tableLimit,
          ent.kdsStationLimit,
        ),
      { timeout: 15000 },
    );
    restaurant = result.restaurant;
    square = result.square;
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
      paymentPath: a.paymentPath,
      requiresPayment: "requiresPayment" in check ? check.requiresPayment : false,
    },
  });
  if (square) {
    await audit({
      organizationId,
      actorUserId: user.id,
      actorEmail: user.email ?? "",
      action: "square.connected",
      resourceType: "Restaurant",
      resourceId: restaurant.id,
      metadata: { ...square, via: "onboarding" },
    });
  }

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
