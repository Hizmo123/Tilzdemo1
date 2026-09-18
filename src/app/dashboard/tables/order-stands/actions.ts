"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { STAND_UNIT_PRICE_CENTS } from "@/lib/plans";
import { generateStandId, nextStandSerial } from "@/lib/stands";
import { audit } from "@/lib/audit";

export type OrderStandsState = { error?: string; ok?: boolean };

const schema = z.object({
  tableIds: z.array(z.string()).min(1, "Select at least one table."),
  shippingAddress: z.object({
    line1: z.string().trim().min(1, "Enter a street address."),
    line2: z.string().trim().optional().or(z.literal("")),
    suburb: z.string().trim().min(1, "Enter a suburb."),
    state: z.string().trim().min(1, "Enter a state."),
    postcode: z.string().trim().min(1, "Enter a postcode."),
  }),
});

// One-time purchase, paid immediately via the existing mock payment
// provider (src/lib/payments — no real Stripe integration exists yet in
// this codebase; this reuses the exact same abstraction every bill payment
// already goes through, so it charges/labels itself identically: test:true,
// no real money moves). Stands are created ONLY after the charge succeeds —
// never speculatively beforehand.
export async function orderStands(input: {
  tableIds: string[];
  shippingAddress: {
    line1: string;
    line2?: string;
    suburb: string;
    state: string;
    postcode: string;
  };
}): Promise<OrderStandsState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) {
    return { error: "You don't have permission to order stands." };
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  const organizationId = authz.membership?.organizationId;
  if (!restaurant || !organizationId) return { error: "Create your restaurant first." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const a = parsed.data;

  // Every selected table must actually belong to this restaurant — never
  // trust ids from the client beyond that they're strings.
  const ownedTables = await prisma.table.findMany({
    where: { id: { in: a.tableIds }, location: { restaurantId: restaurant.id } },
    select: { id: true, label: true },
  });
  if (ownedTables.length !== a.tableIds.length) {
    return { error: "One or more selected tables couldn't be found." };
  }

  const quantity = ownedTables.length;
  const amountCents = quantity * STAND_UNIT_PRICE_CENTS;

  const provider = getPaymentProvider();
  const idempotencyKey = `stand_order_${restaurant.id}_${randomBytes(8).toString("hex")}`;
  const result = await provider.createPayment({
    amountCents,
    currency: restaurant.currency,
    idempotencyKey,
    metadata: { restaurantId: restaurant.id, quantity: String(quantity), kind: "stand_order" },
  });

  if (result.status !== "SUCCEEDED") {
    return { error: "Payment didn't go through. Please try again." };
  }

  const { orderId } = await prisma.$transaction(async (tx) => {
    const order = await tx.standOrder.create({
      data: {
        organizationId,
        restaurantId: restaurant.id,
        status: "PAID",
        quantity,
        amountCents,
        paidAt: new Date(),
        shippingAddress: a.shippingAddress,
      },
    });

    // Sequential — each call re-counts within the same transaction, so a
    // batch of N stands gets N consecutive serials, not N duplicates.
    for (const table of ownedTables) {
      const serial = await nextStandSerial(tx);
      await tx.tillzStand.create({
        data: {
          id: generateStandId(),
          serial,
          status: "ORDERED",
          organizationId,
          restaurantId: restaurant.id,
          tableId: table.id,
          orderId: order.id,
        },
      });
    }

    return { orderId: order.id };
  });

  await audit({
    organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "stand_order.paid",
    resourceType: "StandOrder",
    resourceId: orderId,
    metadata: { quantity, amountCents },
  });

  revalidatePath("/dashboard/tables");
  revalidatePath("/dashboard/tables/order-stands");
  return { ok: true };
}
