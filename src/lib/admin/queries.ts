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
import type { StandOrderStatus } from "@prisma/client";

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
