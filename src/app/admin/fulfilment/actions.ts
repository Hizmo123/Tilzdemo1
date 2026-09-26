"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type FulfilmentActionState = { error?: string; ok?: boolean };

// Same pattern as admin/orgs/actions.ts's own adminEmail() — duplicated
// locally rather than shared, matching that file's convention.
async function adminEmail(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "unknown";
}

// The gate: an order with an uploaded design can't move to printed/shipped
// while that design is still awaiting review or was rejected. An order with
// NO design (designImageUrl null — the overwhelming majority) skips this
// entirely regardless of designStatus's default value.
function designBlockReason(
  order: { designImageUrl: string | null; designStatus: string },
  toward: "printed" | "shipped",
): string | null {
  if (!order.designImageUrl) return null;
  if (order.designStatus === "PENDING_REVIEW") {
    return `This order's design is still awaiting review — approve or reject it before marking ${toward}.`;
  }
  if (order.designStatus === "REJECTED") {
    return `This order's design was rejected — that needs resolving before marking ${toward}.`;
  }
  return null;
}

// PAID -> PRINTED: just a status flip, no side effects on the stands
// themselves — they're already UNCLAIMED and stay that way; printing
// doesn't change what they resolve to.
export async function markOrderPrinted(orderId: string): Promise<FulfilmentActionState> {
  await requirePlatformAdmin(); // re-checked independently of the layout — see lib/platform-admin.ts

  const order = await prisma.standOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PAID") {
    return { error: "This order isn't ready to mark printed." };
  }
  const blocked = designBlockReason(order, "printed");
  if (blocked) return { error: blocked };

  await prisma.standOrder.update({ where: { id: orderId }, data: { status: "PRINTED" } });
  revalidatePath("/admin/fulfilment");
  return { ok: true };
}

// PRINTED -> SHIPPED: sets shippedAt only. Deliberately does NOT touch any
// stand's status/tableId — a stand only ever becomes ACTIVE when a staff
// member at the venue types its serial into the "Activate a stand" flow
// (see lib/stands.ts#activateStandBySerial). Shipping is a logistics event,
// not an activation event.
//
// The design gate is re-checked here too, not just at the PAID -> PRINTED
// step — in the ordinary flow a PRINTED order already cleared it, but this
// stays a real check (not an assumption) in case a design somehow gets
// un-approved after printing, or this action is invoked directly.
export async function markOrderShipped(orderId: string): Promise<FulfilmentActionState> {
  await requirePlatformAdmin();

  const order = await prisma.standOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PRINTED") {
    return { error: "This order isn't ready to mark shipped." };
  }
  const blocked = designBlockReason(order, "shipped");
  if (blocked) return { error: blocked };

  await prisma.standOrder.update({
    where: { id: orderId },
    data: { status: "SHIPPED", shippedAt: new Date() },
  });

  revalidatePath("/admin/fulfilment");
  return { ok: true };
}

// ---- Design review ---------------------------------------------------------

export async function approveOrderDesign(orderId: string): Promise<FulfilmentActionState> {
  await requirePlatformAdmin();
  const email = await adminEmail();

  const order = await prisma.standOrder.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Order not found." };
  if (!order.designImageUrl) return { error: "This order has no design to review." };

  await prisma.standOrder.update({
    where: { id: orderId },
    data: {
      designStatus: "APPROVED",
      designNotes: null,
      designReviewedAt: new Date(),
      designReviewedByEmail: email,
    },
  });

  revalidatePath("/admin/fulfilment");
  return { ok: true };
}

// Rejecting always requires a note — the venue needs to know why (see
// designNotes' doc comment on the schema: "why rejected").
export async function rejectOrderDesign(orderId: string, note: string): Promise<FulfilmentActionState> {
  await requirePlatformAdmin();
  const email = await adminEmail();

  const trimmed = note.trim();
  if (!trimmed) return { error: "Explain why this design is being rejected." };

  const order = await prisma.standOrder.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Order not found." };
  if (!order.designImageUrl) return { error: "This order has no design to review." };

  await prisma.standOrder.update({
    where: { id: orderId },
    data: {
      designStatus: "REJECTED",
      designNotes: trimmed,
      designReviewedAt: new Date(),
      designReviewedByEmail: email,
    },
  });

  revalidatePath("/admin/fulfilment");
  return { ok: true };
}
