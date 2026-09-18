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
import type { StandOrderStatus, PlanTier, StandStatus } from "@prisma/client";
import { PLANS, planByTier } from "@/lib/plans";
import { entitlementsForTier } from "@/lib/entitlements";

// Stand orders for the admin fulfilment queue (Task 4). Defaults to PAID,
// unshipped-first — that's the actual work queue; PENDING_PAYMENT orders
// never got here (no stands exist for them yet) and CANCELLED ones are done.
//
// StandOrder.restaurantId/organizationId are plain scalars, not formal
// Prisma relations (see the schema comment on TillzStand — same reasoning:
// this table is meant to be read cross-tenant, not joined through the
// tenant-scoped Restaurant/Organization graph), so the venue/org names are
// batch-fetched separately and joined in application code rather than via a
// Prisma `include`.
export async function listFulfilmentOrders(status?: StandOrderStatus) {
  const orders = await prisma.standOrder.findMany({
    where: status ? { status } : { status: { in: ["PAID", "PRINTED", "SHIPPED"] } },
    orderBy: [{ shippedAt: "asc" }, { paidAt: "asc" }],
    include: {
      stands: {
        select: { id: true, serial: true, status: true, table: { select: { label: true } } },
        orderBy: { serial: "asc" },
      },
    },
  });

  const restaurantIds = [...new Set(orders.map((o) => o.restaurantId))];
  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: { id: true, name: true, organization: { select: { name: true } } },
  });
  const byId = new Map(restaurants.map((r) => [r.id, r]));

  return orders.map((order) => ({
    ...order,
    restaurantName: byId.get(order.restaurantId)?.name ?? "(deleted venue)",
    organizationName: byId.get(order.restaurantId)?.organization.name ?? "(deleted org)",
  }));
}

export async function getFulfilmentOrder(orderId: string) {
  const order = await prisma.standOrder.findUnique({
    where: { id: orderId },
    include: {
      stands: {
        select: { id: true, serial: true, status: true, table: { select: { label: true } } },
        orderBy: { serial: "asc" },
      },
    },
  });
  if (!order) return null;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: order.restaurantId },
    select: { name: true, slug: true },
  });

  return { order, restaurant };
}

// ---- Platform overview (Task 6) ---------------------------------------------

export type PlatformOverview = {
  mrrCents: number;
  mrrByTier: { tier: PlanTier; orgs: number; mrrCents: number }[];
  subscriptions: { active: number; inGrace: number; lapsed: number; free: number };
  totals: { organisations: number; venues: number; published: number; unpublished: number };
  funnel: { signedUp: number; completedOnboarding: number; published: number; firstOrder: number };
  standInventory: Record<StandStatus, number>;
  openFulfilmentOrders: number;
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

  const [venues, publishedVenues, standCounts, restaurantsWithOrders] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { onboardingCompletedAt: { not: null } } }),
    prisma.tillzStand.groupBy({ by: ["status"], _count: true }),
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

  const standInventory = {
    ORDERED: 0,
    PRINTED: 0,
    SHIPPED: 0,
    ACTIVE: 0,
    DEACTIVATED: 0,
  } as Record<StandStatus, number>;
  for (const row of standCounts) standInventory[row.status] = row._count;

  const openFulfilmentOrders = await prisma.standOrder.count({
    where: { status: { in: ["PAID", "PRINTED"] } },
  });

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
    standInventory,
    openFulfilmentOrders,
    orgsOverVenueLimit,
  };
}

// ---- Organisation directory (Task 6) ----------------------------------------

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

export async function getOrgDetail(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      restaurants: { select: { id: true, name: true, slug: true, onboardingCompletedAt: true, createdAt: true } },
      memberships: { select: { email: true, role: true, createdAt: true } },
    },
  });
  if (!org) return null;

  const standOrders = await prisma.standOrder.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, quantity: true, amountCents: true, createdAt: true, paidAt: true },
  });

  return { org, standOrders };
}
