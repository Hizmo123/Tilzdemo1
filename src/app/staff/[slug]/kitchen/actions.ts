"use server";

import { revalidatePath } from "next/cache";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import {
  advanceOrderStatus,
  staffApproveOrder,
  staffRejectOrder,
  recallOrder,
  staffCloseBillById,
  type OrderStatusName,
} from "@/lib/bills";

// Advances a kitchen ticket's status. Staff-session authorized, scoped to the
// venue, gated on kitchen:manage. Transition validity is enforced in the service.
export async function advanceOrder(
  slug: string,
  orderId: string,
  to: OrderStatusName,
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "kitchen:manage"))
    return { error: "Your role can't update the kitchen." };

  const res = await advanceOrderStatus(orderId, session.restaurant.id, to);
  if ("error" in res) return res;

  revalidatePath(`/staff/${slug}/kitchen`);
  revalidatePath(`/staff/${slug}/home`);
  return { ok: true as const };
}

// Accept a customer order that was held for approval → it becomes a live ticket.
export async function approveOrder(slug: string, orderId: string) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "kitchen:manage"))
    return { error: "Your role can't update the kitchen." };

  const res = await staffApproveOrder(orderId, session.restaurant.id);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/kitchen`);
  revalidatePath(`/staff/${slug}/home`);
  return { ok: true as const };
}

// Reject a held order → cancel it and take its items off the bill.
export async function rejectOrder(slug: string, orderId: string) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "kitchen:manage"))
    return { error: "Your role can't update the kitchen." };

  const res = await staffRejectOrder(orderId, session.restaurant.id);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/kitchen`);
  revalidatePath(`/staff/${slug}/home`);
  return { ok: true as const };
}

// Bring a served ticket back onto the board (bumped by mistake).
export async function recallTicket(slug: string, orderId: string) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "kitchen:manage"))
    return { error: "Your role can't update the kitchen." };

  const res = await recallOrder(orderId, session.restaurant.id);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/kitchen`);
  return { ok: true as const };
}

// Mark a pickup order's bill paid at the counter.
export async function markPickupPaid(slug: string, billId: string) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't take payments." };

  const res = await staffCloseBillById(billId, session.restaurant.id);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/kitchen`);
  return { ok: true as const };
}
