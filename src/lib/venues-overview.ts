import { prisma } from "@/lib/prisma";
import { startOfTodayInTz, addDays } from "@/lib/time";
import type { ResolvedRange } from "@/lib/date-range";

// No cross-venue query existed anywhere before this — every dashboard page
// reads organization.restaurants[0] only. This is the free-tier list (see
// entitlements.crossVenueList): name, today's sales, live/offline status,
// and — for a CONNECT venue specifically — Square connection health.
export type SquareHealth = "connected" | "needs_location" | "revoked" | "not_connected";

export type VenueOverviewRow = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  published: boolean;
  todaySalesCents: number;
  squareHealth: SquareHealth | null; // null when the tier doesn't use Square at all
};

async function squareHealthFor(restaurantId: string): Promise<SquareHealth> {
  const connection = await prisma.squareConnection.findUnique({
    where: { restaurantId },
    select: { revokedAt: true, locationId: true },
  });
  if (!connection) return "not_connected";
  if (connection.revokedAt) return "revoked";
  if (!connection.locationId) return "needs_location";
  return "connected";
}

export async function getVenuesOverview(organizationId: string): Promise<VenueOverviewRow[]> {
  const restaurants = await prisma.restaurant.findMany({
    where: { organizationId },
    select: { id: true, name: true, slug: true, currency: true, published: true, timezone: true },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    restaurants.map(async (r) => {
      const todayStart = startOfTodayInTz(r.timezone);
      const tomorrowStart = addDays(todayStart, 1);
      const [sales, health] = await Promise.all([
        prisma.bill.aggregate({
          where: { restaurantId: r.id, status: "PAID", paidAt: { gte: todayStart, lt: tomorrowStart } },
          _sum: { amountPaidCents: true },
        }),
        // Square health is meaningful for any venue with a connection
        // attempt on record, not just CONNECT — a Growth/Pro venue that
        // connected Square for catalog sync still benefits from seeing it
        // here; the page decides whether to SHOW the column, this just
        // always resolves it.
        squareHealthFor(r.id),
      ]);
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        currency: r.currency,
        published: r.published,
        todaySalesCents: sales._sum.amountPaidCents ?? 0,
        squareHealth: health,
      };
    }),
  );
}

export type VenueRangeRow = {
  id: string;
  name: string;
  currency: string;
  revenueCents: number;
  paidOrders: number;
};

// The deeper view (entitlements.crossVenueDashboard: PRO always, CONNECT
// only with the Connect Plus addon) — the same [restaurantId, status,
// paidAt] shape lib/analytics.ts#getRevenueOverview uses for one venue,
// run across every venue in the org side by side for one shared range.
export async function getVenuesRangeComparison(
  organizationId: string,
  range: ResolvedRange,
): Promise<VenueRangeRow[]> {
  const restaurants = await prisma.restaurant.findMany({
    where: { organizationId },
    select: { id: true, name: true, currency: true },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    restaurants.map(async (r) => {
      const agg = await prisma.bill.aggregate({
        where: { restaurantId: r.id, status: "PAID", paidAt: { gte: range.from, lt: range.to } },
        _sum: { amountPaidCents: true },
        _count: true,
      });
      return {
        id: r.id,
        name: r.name,
        currency: r.currency,
        revenueCents: agg._sum.amountPaidCents ?? 0,
        paidOrders: agg._count,
      };
    }),
  );
}
