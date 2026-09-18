"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export type FulfilmentActionState = { error?: string; ok?: boolean };

// PAID -> PRINTED: just a status flip, no side effects on the stands
// themselves — they're already UNCLAIMED and stay that way; printing
// doesn't change what they resolve to.
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

// PRINTED -> SHIPPED: sets shippedAt only. Deliberately does NOT touch any
// stand's status/tableId — a stand only ever becomes ACTIVE when a staff
// member at the venue types its serial into the "Activate a stand" flow
// (see lib/stands.ts#activateStandBySerial). Shipping is a logistics event,
// not an activation event.
export async function markOrderShipped(orderId: string): Promise<FulfilmentActionState> {
  await requirePlatformAdmin();

  const order = await prisma.standOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PRINTED") {
    return { error: "This order isn't ready to mark shipped." };
  }

  await prisma.standOrder.update({
    where: { id: orderId },
    data: { status: "SHIPPED", shippedAt: new Date() },
  });

  revalidatePath("/admin/fulfilment");
  return { ok: true };
}
