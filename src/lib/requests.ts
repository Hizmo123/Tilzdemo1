import { prisma } from "@/lib/prisma";
import { resolveVisit } from "@/lib/bills";

export type RequestTypeName =
  | "WATER"
  | "CUTLERY"
  | "ASSISTANCE"
  | "BILL"
  | "OTHER";

export type RequestStatusName = "OPEN" | "ACKNOWLEDGED" | "COMPLETED";

// Creates a customer service request for the table behind an opaque visit token.
// No auth — possession of the token is the capability, same as ordering.
export async function createCustomerRequest(
  token: string,
  type: RequestTypeName,
  note?: string,
) {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };

  // Rate-limit noise: if an identical OPEN request already exists for the table,
  // don't stack duplicates.
  const existing = await prisma.customerRequest.findFirst({
    where: { tableId: resolved.visit.tableId, type, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  });
  if (existing) return { ok: true as const };

  await prisma.customerRequest.create({
    data: {
      tableId: resolved.visit.tableId,
      restaurantId: resolved.visit.restaurantId,
      type,
      note: note?.slice(0, 200) || null,
    },
  });
  return { ok: true as const };
}

export async function getOpenRequests(restaurantId: string) {
  return prisma.customerRequest.findMany({
    where: { restaurantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    orderBy: { createdAt: "asc" },
    include: { table: true },
  });
}

export async function countOpenRequests(restaurantId: string) {
  return prisma.customerRequest.count({
    where: { restaurantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  });
}

// Moves a request forward (OPEN → ACKNOWLEDGED → COMPLETED), restaurant-scoped.
export async function updateRequestStatus(
  requestId: string,
  restaurantId: string,
  to: RequestStatusName,
) {
  const req = await prisma.customerRequest.findFirst({
    where: { id: requestId, restaurantId },
  });
  if (!req) return { error: "Request not found." };

  await prisma.customerRequest.update({
    where: { id: req.id },
    data: {
      status: to,
      acknowledgedAt:
        to === "ACKNOWLEDGED" ? new Date() : req.acknowledgedAt,
      completedAt: to === "COMPLETED" ? new Date() : req.completedAt,
    },
  });
  return { ok: true as const };
}
