// Cross-tenant reads for the platform-admin console. Every function here
// deliberately ignores the normal tenant boundary (organizationId scoping,
// RBAC) that the rest of the app enforces everywhere else — these are meant
// to see across every organisation at once.
//
// SAFE TO USE ONLY after the caller has already run requirePlatformAdmin()
// (src/lib/platform-admin.ts) in the current request — nothing in this file
// checks that itself. Every /admin page and server action must call
// requirePlatformAdmin() before importing/calling anything from here.

import { prisma } from "@/lib/prisma";
import type { PlanTier } from "@prisma/client";
import { ALL_PLANS, planByTier, EXTRA_VENUE_PRICE_CENTS } from "@/lib/plans";
import { entitlementsForTier } from "@/lib/entitlements";

// ---- Platform overview -------------------------------------------------------

export type PlatformOverview = {
  // Real, currently-being-charged revenue only — see the loop below: an org
  // counts here ONLY with Organization.stripeStatus "active" (synced by
  // src/lib/billing/stripe-provider.ts's webhook handler from Stripe's own
  // subscription object). A paid-tier org that was assigned its plan some
  // other way (the pre-Stripe mock model, an admin bypass, grandfathered
  // BASIC with no Stripe price ever configured for it) has no real
  // subscription and is never counted as paying, however its `plan` column
  // reads — see subscriptions.noRealSubscription.
  mrrCents: number;
  // LITE/GROWTH/PRO only — CONNECT has no subscription (its revenue is
  // connectFeeRevenueCents below) and BASIC is grandfathered with no Stripe
  // price ever configured for it, so it can never have a real subscription.
  // PRO's bucket folds in its extra-venue add-on revenue (see
  // extraVenueCents below) rather than breaking it out as a separate line,
  // since Stripe bills it as one more item on the SAME subscription.
  mrrByTier: { tier: PlanTier; orgs: number; mrrCents: number }[];
  // What every currently-trialing org would add to MRR once its trial
  // converts (same priceCents + extra-venue math as active MRR) — kept
  // separate because nothing has actually been charged yet; a trialing org
  // contributes $0 to mrrCents itself.
  trialPipelineCents: number;
  // Tillz's own per-order application fee actually collected from Connect
  // (pay-as-you-sell) orgs — summed from Payment.appFeeCents (set by
  // computeAppFeeCents, lib/square/pay.ts, on every Square-connected
  // charge). null — not 0 — when no such Payment row exists at all, so the
  // UI can tell "zero collected" apart from "nothing to report yet".
  connectFeeRevenueCents: number | null;
  subscriptions: {
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    // CONNECT: no subscription by design, never counted as a "lapsed" or
    // "noRealSubscription" paid org even though stripeStatus is null for it.
    connect: number;
    // A paid tier (LITE/GROWTH/PRO/BASIC) with no real Stripe subscription —
    // the exact case the old version of this function miscounted as paying
    // revenue. Investigate these before trusting mrrCents against a Stripe
    // dashboard total.
    noRealSubscription: number;
  };
  totals: { organisations: number; venues: number; published: number; unpublished: number };
  funnel: { signedUp: number; completedOnboarding: number; published: number; firstOrder: number };
  // Orgs over THEIR TIER'S venue limit — for PRO specifically this is the
  // normal, paid-for "extra venue" case (now priced into mrrCents/
  // mrrByTier above via extraVenueCents, not a gap); for every other tier
  // canCreateVenue hard-blocks creating past the limit, so a non-PRO org
  // showing up here would mean something wrote around that gate, not a
  // missing price.
  orgsOverVenueLimit: number;
};

// PRO's paid-per-venue addon past the 3 included (lib/entitlements.ts#
// canCreateVenue, synced to a real Stripe subscription item by
// src/lib/billing/stripe-provider.ts#syncExtraVenueQuantity) — billed on
// the SAME subscription as the base PRO price, so its cost folds into
// mrrByTier's PRO bucket rather than its own line.
function extraVenueCents(plan: PlanTier, restaurantCount: number): number {
  if (plan !== "PRO") return 0;
  return Math.max(0, restaurantCount - 3) * EXTRA_VENUE_PRICE_CENTS;
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      plan: true,
      subscriptionLapsedAt: true,
      stripeStatus: true,
      createdAt: true,
      _count: { select: { restaurants: true } },
    },
  });

  const mrrByTierMap = new Map<PlanTier, { orgs: number; mrrCents: number }>();
  let mrrCents = 0;
  let trialPipelineCents = 0;
  let active = 0;
  let trialing = 0;
  let pastDue = 0;
  let canceled = 0;
  let connect = 0;
  let noRealSubscription = 0;
  let orgsOverVenueLimit = 0;

  for (const org of orgs) {
    const ent = entitlementsForTier(org.plan, { lapsedAt: org.subscriptionLapsedAt });
    if (ent.venueLimit !== null && org._count.restaurants > ent.venueLimit) orgsOverVenueLimit++;

    // CONNECT has no subscription at all by design — its revenue is the
    // per-order fee totalled separately below, never MRR.
    if (org.plan === "CONNECT") {
      connect++;
      continue;
    }

    const price = planByTier(org.plan).priceCents + extraVenueCents(org.plan, org._count.restaurants);

    switch (org.stripeStatus) {
      case "active": {
        active++;
        mrrCents += price;
        const bucket = mrrByTierMap.get(org.plan) ?? { orgs: 0, mrrCents: 0 };
        bucket.orgs++;
        bucket.mrrCents += price;
        mrrByTierMap.set(org.plan, bucket);
        break;
      }
      case "trialing":
        trialing++;
        trialPipelineCents += price;
        break;
      case "past_due":
        pastDue++;
        break;
      case "canceled":
      case "unpaid":
      case "incomplete_expired":
        canceled++;
        break;
      default:
        // null/undefined, or any other Stripe status this app doesn't
        // treat as a confirmed subscription — never counted as revenue.
        noRealSubscription++;
        break;
    }
  }

  const mrrByTier = ALL_PLANS.filter((p) => p.tier !== "CONNECT" && p.tier !== "BASIC").map((p) => ({
    tier: p.tier,
    orgs: mrrByTierMap.get(p.tier)?.orgs ?? 0,
    mrrCents: mrrByTierMap.get(p.tier)?.mrrCents ?? 0,
  }));

  const connectFeeAgg = await prisma.payment.aggregate({
    _sum: { appFeeCents: true },
    _count: { appFeeCents: true },
    where: { status: "SUCCEEDED", appFeeCents: { not: null } },
  });
  const connectFeeRevenueCents = connectFeeAgg._count.appFeeCents > 0 ? connectFeeAgg._sum.appFeeCents ?? 0 : null;

  const [venues, publishedVenues, restaurantsWithOrders] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { published: true } }),
    // Distinct restaurantIds with at least one Order — Order.restaurantId is
    // a plain denormalized field, so this is a direct query rather than a
    // deep menu -> item -> billItem traversal.
    prisma.order.findMany({ distinct: ["restaurantId"], select: { restaurantId: true } }),
  ]);
  const restaurantIdsWithOrders = new Set(restaurantsWithOrders.map((o) => o.restaurantId));
  const orgIdByRestaurantId = new Map<string, string>();
  const restaurantOrgRows = await prisma.restaurant.findMany({
    where: { id: { in: [...restaurantIdsWithOrders] } },
    select: { id: true, organizationId: true },
  });
  for (const r of restaurantOrgRows) orgIdByRestaurantId.set(r.id, r.organizationId);
  const firstOrderOrgCount = new Set(orgIdByRestaurantId.values()).size;

  return {
    mrrCents,
    mrrByTier,
    trialPipelineCents,
    connectFeeRevenueCents,
    subscriptions: { active, trialing, pastDue, canceled, connect, noRealSubscription },
    totals: {
      organisations: orgs.length,
      venues,
      published: publishedVenues,
      unpublished: venues - publishedVenues,
    },
    // "Signed up" and "completed onboarding" are the same count here — no
    // Restaurant/Membership row exists until completeOnboarding runs (see
    // src/app/onboarding/actions.ts), so an Organization only ever exists
    // post-onboarding. "Published" now reads the real Restaurant.published
    // flag (dashboard/actions.ts#publishRestaurant) — this used to proxy off
    // onboardingCompletedAt before that flag existed.
    funnel: {
      signedUp: orgs.length,
      completedOnboarding: orgs.length,
      published: publishedVenues,
      firstOrder: firstOrderOrgCount,
    },
    orgsOverVenueLimit,
  };
}

// ---- Organisation directory ---------------------------------------------------

export async function searchOrganizations(query?: string) {
  return prisma.organization.findMany({
    where: query
      ? { name: { contains: query, mode: "insensitive" } }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      plan: true,
      planStatus: true,
      subscriptionLapsedAt: true,
      createdAt: true,
      restaurants: { select: { id: true, name: true, onboardingCompletedAt: true } },
    },
  });
}

// Recent cross-org activity, reusing the existing AuditLog rather than a
// separate admin-only log — it already records "who did what" per org
// (see lib/audit.ts); this just reads it unscoped.
export async function getRecentActivity(limit = 25) {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, organizationId: true, actorEmail: true, action: true, createdAt: true },
  });
  const orgIds = [...new Set(rows.map((r) => r.organizationId))];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(orgs.map((o) => [o.id, o.name]));
  return rows.map((r) => ({ ...r, organizationName: nameById.get(r.organizationId) ?? "(deleted org)" }));
}

// No `select` on the top-level org, so every Organization scalar column
// (plan, planStatus, subscriptionLapsedAt, deactivatedAt, deactivatedByEmail,
// deletionExecutedAt, deletionPurgeEligibleAt, deletedByEmail, cardLast4,
// subscribedAt, ...) is already present on the returned `org` — the admin
// controls card (see orgs/[orgId]/page.tsx) reads these directly, nothing
// further to add here.
export async function getOrgDetail(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      restaurants: { select: { id: true, name: true, slug: true, onboardingCompletedAt: true, createdAt: true } },
      memberships: { select: { email: true, role: true, createdAt: true } },
    },
  });
  if (!org) return null;

  return { org };
}

// ---- Account lifecycle ---------------------------------------------------

// Orgs an admin has suspended — the list /admin/accounts surfaces. An org its
// OWNER deleted also has deactivatedAt set (that's how login is blocked), but
// it isn't "suspended" and must never appear here with a Reactivate button:
// it's closed for good and lives on /admin/deletions instead.
export async function listAccountLifecycle() {
  const [suspended, deletedCount] = await Promise.all([
    prisma.organization.findMany({
      where: { deactivatedAt: { not: null }, planStatus: { not: "deleted" } },
      orderBy: { deactivatedAt: "desc" },
      select: {
        id: true,
        name: true,
        plan: true,
        planStatus: true,
        deactivatedAt: true,
        deactivatedByEmail: true,
      },
    }),
    prisma.organization.count({ where: { planStatus: "deleted" } }),
  ]);

  return { suspended, deletedCount };
}

// Orgs whose owner deleted them — earliest retention end first, so whatever is
// closest to (or past) purge-eligibility is at the top of /admin/deletions.
export async function listDeletedOrganizations() {
  return prisma.organization.findMany({
    where: { planStatus: "deleted" },
    orderBy: [{ deletionPurgeEligibleAt: "asc" }, { deletionExecutedAt: "asc" }],
    select: {
      id: true,
      name: true,
      planStatus: true,
      deletedByEmail: true,
      deletionExecutedAt: true,
      deletionPurgeEligibleAt: true,
    },
  });
}

// ---- Stand fulfilment ---------------------------------------------------

// Lightweight counts for the admin home page's "open" queue widget — the
// full order list with addresses/table breakdown lives at /admin/fulfilment
// itself, this is just enough to surface that something's waiting.
export async function getFulfilmentCounts() {
  const [awaitingPrint, awaitingShip] = await Promise.all([
    prisma.standOrder.count({ where: { status: "PAID" } }),
    prisma.standOrder.count({ where: { status: "PRINTED" } }),
  ]);
  return { awaitingPrint, awaitingShip };
}

// Paid orders the platform still owes a print/ship on, PAID first (nothing
// shipped yet), then PRINTED, oldest paid first within each — mirrors a
// real print queue. PENDING_PAYMENT orders never appear here; they aren't
// this team's problem until the charge actually succeeds.
export async function listFulfilmentOrders() {
  return prisma.standOrder.findMany({
    where: { status: { in: ["PAID", "PRINTED", "SHIPPED"] } },
    orderBy: [{ status: "asc" }, { paidAt: "asc" }],
    include: {
      organization: { select: { name: true } },
      restaurant: { select: { name: true, slug: true } },
      items: {
        include: {
          table: { select: { label: true } },
          stand: { select: { serial: true, qrToken: true } },
        },
      },
    },
  });
}

// ---- Stand product catalog ------------------------------------------------

export async function listStandProducts() {
  return prisma.standProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getStandProduct(id: string) {
  return prisma.standProduct.findUnique({ where: { id } });
}

export async function getFulfilmentOrder(orderId: string) {
  return prisma.standOrder.findUnique({
    where: { id: orderId },
    include: {
      organization: { select: { name: true } },
      restaurant: { select: { name: true, slug: true } },
      items: {
        include: {
          table: { select: { label: true } },
          stand: { select: { serial: true, qrToken: true } },
        },
      },
    },
  });
}
