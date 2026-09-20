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
import { PLANS, planByTier } from "@/lib/plans";
import { entitlementsForTier } from "@/lib/entitlements";

// ---- Platform overview -------------------------------------------------------

export type PlatformOverview = {
  mrrCents: number;
  mrrByTier: { tier: PlanTier; orgs: number; mrrCents: number }[];
  subscriptions: { active: number; inGrace: number; lapsed: number; free: number };
  totals: { organisations: number; venues: number; published: number; unpublished: number };
  funnel: { signedUp: number; completedOnboarding: number; published: number; firstOrder: number };
  // No per-extra-venue overage price exists anywhere in this codebase (see
  // lib/entitlements.ts's venueLimit — it only ever BLOCKS creating past the
  // limit, there's no add-on charge). Counted here for visibility rather
  // than inventing a number for the MRR total.
  orgsOverVenueLimit: number;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      plan: true,
      subscriptionLapsedAt: true,
      createdAt: true,
      _count: { select: { restaurants: true } },
    },
  });

  const mrrByTierMap = new Map<PlanTier, { orgs: number; mrrCents: number }>();
  let mrrCents = 0;
  let active = 0;
  let inGrace = 0;
  let lapsed = 0;
  let free = 0;
  let orgsOverVenueLimit = 0;

  for (const org of orgs) {
    const ent = entitlementsForTier(org.plan, { lapsedAt: org.subscriptionLapsedAt });
    if (ent.venueLimit !== null && org._count.restaurants > ent.venueLimit) orgsOverVenueLimit++;

    if (org.plan === "FREE") {
      free++;
      continue;
    }
    // A lapsed-and-past-grace subscription isn't paying right now — leave it
    // out of MRR. In-grace still counts: the charge is presumed retried, not
    // yet confirmed failed for good.
    if (ent.orderingBlocked) {
      lapsed++;
      continue;
    }
    if (ent.lapsed) inGrace++;
    else active++;

    const price = planByTier(org.plan).priceCents;
    mrrCents += price;
    const bucket = mrrByTierMap.get(org.plan) ?? { orgs: 0, mrrCents: 0 };
    bucket.orgs++;
    bucket.mrrCents += price;
    mrrByTierMap.set(org.plan, bucket);
  }

  const mrrByTier = PLANS.filter((p) => p.tier !== "FREE").map((p) => ({
    tier: p.tier,
    orgs: mrrByTierMap.get(p.tier)?.orgs ?? 0,
    mrrCents: mrrByTierMap.get(p.tier)?.mrrCents ?? 0,
  }));

  const [venues, publishedVenues, restaurantsWithOrders] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { onboardingCompletedAt: { not: null } } }),
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
    subscriptions: { active, inGrace, lapsed, free },
    totals: {
      organisations: orgs.length,
      venues,
      published: publishedVenues,
      unpublished: venues - publishedVenues,
    },
    // "Signed up" and "completed onboarding" are the same count here — no
    // Restaurant/Membership row exists until completeOnboarding runs (see
    // src/app/onboarding/actions.ts), so an Organization only ever exists
    // post-onboarding. "Published" reuses onboardingCompletedAt as the best
    // available proxy — there's no separate publish/unpublish flag in this
    // codebase (see this file's Task 6 commit for the flag).
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
// (plan, planStatus, subscriptionLapsedAt, deactivatedAt,
// deactivatedByEmail, deletionRequestedAt, deletionRequestedByEmail,
// cardLast4, subscribedAt, ...) is already present on the returned `org` —
// the admin controls card (see orgs/[orgId]/page.tsx) reads these directly,
// nothing further to add here.
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

// Orgs an admin has suspended, and orgs whose owner has requested deletion —
// the two lists the /admin/accounts screen surfaces. An org can appear in
// both if a suspended org's owner also requested deletion afterwards.
export async function listAccountLifecycle() {
  const [suspended, deletionRequested] = await Promise.all([
    prisma.organization.findMany({
      where: { deactivatedAt: { not: null } },
      orderBy: { deactivatedAt: "desc" },
      select: {
        id: true,
        name: true,
        plan: true,
        planStatus: true,
        deactivatedAt: true,
        deactivatedByEmail: true,
        deletionRequestedAt: true,
        deletionRequestedByEmail: true,
      },
    }),
    prisma.organization.findMany({
      where: { deletionRequestedAt: { not: null } },
      orderBy: { deletionRequestedAt: "desc" },
      select: {
        id: true,
        name: true,
        plan: true,
        planStatus: true,
        deactivatedAt: true,
        deactivatedByEmail: true,
        deletionRequestedAt: true,
        deletionRequestedByEmail: true,
      },
    }),
  ]);

  return { suspended, deletionRequested };
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
