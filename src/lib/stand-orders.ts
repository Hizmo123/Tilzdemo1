import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { STAND_UNIT_PRICE_CENTS } from "@/lib/plans";
import { mintStand } from "@/lib/stands";

export type PlaceStandOrderResult =
  | { ok: true; orderId: string }
  | { error: string };

// One-time charge + order for physical Tillz stands — one StandOrderItem per
// chosen table. A flat per-unit price, so the amount is always recomputed
// server-side from STAND_UNIT_PRICE_CENTS * tableIds.length, never trusted
// from the client. Mints the actual TillzStand rows only after the charge
// succeeds (mintStandsForOrder below) — a failed/pending charge never
// produces stands to ship.
export async function placeStandOrder(args: {
  organizationId: string;
  restaurantId: string;
  tableIds: string[];
  shippingName: string;
  shippingAddress: string;
  shippingSuburb: string;
  shippingState: string;
  shippingPostcode: string;
}): Promise<PlaceStandOrderResult> {
  const tableIds = [...new Set(args.tableIds)];
  if (tableIds.length === 0) return { error: "Pick at least one table." };

  const tables = await prisma.table.findMany({
    where: {
      id: { in: tableIds },
      location: { restaurantId: args.restaurantId },
    },
  });
  if (tables.length !== tableIds.length) {
    return { error: "One of those tables wasn't found." };
  }

  const quantity = tableIds.length;
  const totalCents = STAND_UNIT_PRICE_CENTS * quantity;

  const order = await prisma.standOrder.create({
    data: {
      organizationId: args.organizationId,
      restaurantId: args.restaurantId,
      status: "PENDING_PAYMENT",
      quantity,
      unitPriceCents: STAND_UNIT_PRICE_CENTS,
      totalCents,
      shippingName: args.shippingName,
      shippingAddress: args.shippingAddress,
      shippingSuburb: args.shippingSuburb,
      shippingState: args.shippingState,
      shippingPostcode: args.shippingPostcode,
      items: {
        create: tableIds.map((tableId) => ({ tableId })),
      },
    },
  });

  const provider = getPaymentProvider();
  const idempotencyKey = `standorder_${order.id}_${randomBytes(8).toString("hex")}`;
  const result = await provider.createPayment({
    amountCents: totalCents,
    currency: "AUD",
    idempotencyKey,
    metadata: { standOrderId: order.id, quantity: String(quantity) },
  });

  if (result.status !== "SUCCEEDED") {
    return { error: "Payment failed. Please try again." };
  }

  await prisma.standOrder.update({
    where: { id: order.id },
    data: { status: "PAID", paidAt: new Date() },
  });

  await mintStandsForOrder(order.id);

  return { ok: true, orderId: order.id };
}

// Mints one UNCLAIMED TillzStand per StandOrderItem that doesn't already
// have one — called right after payment succeeds, but written to be safely
// re-callable (e.g. from an admin "resend" action) since each item is
// guarded on its own standId already being set.
export async function mintStandsForOrder(orderId: string): Promise<void> {
  const order = await prisma.standOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status === "PENDING_PAYMENT") return;

  for (const item of order.items) {
    if (item.standId) continue;
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.standOrderItem.findUnique({ where: { id: item.id } });
      if (!fresh || fresh.standId) return;
      const stand = await mintStand(tx, {
        organizationId: order.organizationId,
        restaurantId: order.restaurantId,
      });
      await tx.tillzStand.update({
        where: { id: stand.id },
        data: { orderId: order.id },
      });
      await tx.standOrderItem.update({
        where: { id: fresh.id },
        data: { standId: stand.id },
      });
    });
  }
}
