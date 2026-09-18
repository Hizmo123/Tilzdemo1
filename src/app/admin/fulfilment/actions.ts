"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export type FulfilmentActionState = { error?: string; ok?: boolean };

// PAID -> PRINTED: just a status flip, no side effects on the stands
// themselves (they're already ORDERED; printing doesn't change what they
// resolve to).
export async function markOrderPrinted(orderId: string): Promise<FulfilmentActionState> {
  await requirePlatformAdmin(); // re-checked independently of the layout — see lib/platform-admin.ts

  const order = await prisma.standOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PAID") {
    return { error: "This order isn't ready to mark printed." };
  }

  await prisma.standOrder.update({ where: { id: orderId }, data: { status: "PRINTED" } });
  revalidatePath("/admin/fulfilment");
  return { ok: true };
}

// PRINTED -> SHIPPED: sets shippedAt AND flips every stand in this order to
// ACTIVE, since that's the moment their /s/<id> should start actually
// resolving (see lib/stands.ts#resolveStand — DEACTIVATED/non-ACTIVE never
// resolves). Both changes happen in one transaction so a stand can never end
// up ACTIVE while its order is still sitting at PRINTED, or vice versa.
export async function markOrderShipped(orderId: string): Promise<FulfilmentActionState> {
  await requirePlatformAdmin();

  const order = await prisma.standOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PRINTED") {
    return { error: "This order isn't ready to mark shipped." };
  }

  await prisma.$transaction([
    prisma.standOrder.update({
      where: { id: orderId },
      data: { status: "SHIPPED", shippedAt: new Date() },
    }),
    prisma.tillzStand.updateMany({
      where: { orderId },
      data: { status: "ACTIVE" },
    }),
  ]);

  revalidatePath("/admin/fulfilment");
  return { ok: true };
}
