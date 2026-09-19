import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { mintStand } from "@/lib/stands";

export type PlaceStandOrderResult =
  | { ok: true; orderId: string }
  | { error: string };

// One-time charge + order for physical Tillz stands — one StandOrderItem per
// chosen table. Price always comes from the server's own read of the
// StandProduct row (never trusted from the client) — unitPriceCents is that
// product's CURRENT priceCents at order time, and totalCents is
// unitPriceCents * tableIds.length. productTitleSnapshot/productType are
// copied onto the order too, so a later edit or retirement of the product
// never changes what a past order shows it bought. Mints the actual
// TillzStand rows only after the charge succeeds (mintStandsForOrder below)
// — a failed/pending charge never produces stands to ship.
export async function placeStandOrder(args: {
  organizationId: string;
  restaurantId: string;
  standProductId: string;
  tableIds: string[];
  shippingName: string;
  shippingAddress: string;
  shippingSuburb: string;
  shippingState: string;
  shippingPostcode: string;
}): Promise<PlaceStandOrderResult> {
  const tableIds = [...new Set(args.tableIds)];
  if (tableIds.length === 0) return { error: "Pick at least one table." };

  const [tables, product] = await Promise.all([
    prisma.table.findMany({
      where: {
        id: { in: tableIds },
        location: { restaurantId: args.restaurantId },
      },
    }),
    prisma.standProduct.findUnique({ where: { id: args.standProductId } }),
  ]);
  if (tables.length !== tableIds.length) {
    return { error: "One of those tables wasn't found." };
  }
  if (!product || !product.active) {
    return { error: "That product is no longer available." };
  }

  const quantity = tableIds.length;
  const totalCents = product.priceCents * quantity;

  const order = await prisma.standOrder.create({
    data: {
      organizationId: args.organizationId,
      restaurantId: args.restaurantId,
      status: "PENDING_PAYMENT",
      standProductId: product.id,
      productTitleSnapshot: product.title,
      productType: product.type,
      quantity,
      unitPriceCents: product.priceCents,
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
    if (item.standId) continue; // cheap fast path — skip the tx/lock entirely when already minted
    await prisma.$transaction(async (tx) => {
      // Row lock: blocks a concurrent mintStandsForOrder call on this same
      // item until this transaction commits (or rolls back), so the
      // standId re-read right after actually reflects any winner that got
      // here first — unlike a plain SELECT under Postgres's default
      // read-committed isolation, which would let both calls see standId
      // as still null and mint twice.
      const [locked] = await tx.$queryRaw<{ standId: string | null }[]>`
        SELECT "standId" FROM "StandOrderItem" WHERE id = ${item.id} FOR UPDATE
      `;
      if (!locked || locked.standId) return;

      const stand = await mintStand(tx, {
        organizationId: order.organizationId,
        restaurantId: order.restaurantId,
      });
      await tx.tillzStand.update({
        where: { id: stand.id },
        data: { orderId: order.id },
      });
      await tx.standOrderItem.update({
        where: { id: item.id },
        data: { standId: stand.id },
      });
    });
  }
}
