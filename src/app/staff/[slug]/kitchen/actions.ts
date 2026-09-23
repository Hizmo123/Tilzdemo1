"use server";

import { revalidatePath } from "next/cache";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import {
  advanceOrderStatus,
  staffApproveOrder,
  staffRejectOrder,
  recallOrder,
  refireItems,
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

  // Server-derived, same as the kitchen page's own lockedStation — never a
  // client-supplied value. Only meaningful for the SERVED transition on a
  // multi-station order; see resolveStationServedTransition in lib/bills.ts.
  const station = session.staff.role === "KITCHEN" ? session.staff.assignedStation : null;

  const res = await advanceOrderStatus(orderId, session.restaurant.id, to, station);
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

  // Staff PIN accounts have no email — `name` is the closest identifier,
  // same convention as staffRefundPayment in table/[tableId]/actions.ts.
  const res = await staffRejectOrder(orderId, session.restaurant.id, {
    userId: session.staff.id,
    email: session.staff.name,
  });
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

// Re-fire item(s) that need re-cooking (dropped plate, send-back) as a new,
// clearly-marked ticket — see refireItems in lib/bills.ts for why this can
// never double-bill the guest.
export async function refireTicketItems(
  slug: string,
  billItemIds: string[],
  note?: string,
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "kitchen:manage"))
    return { error: "Your role can't update the kitchen." };

  const res = await refireItems(session.restaurant.id, billItemIds, note);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/kitchen`);
  return { ok: true as const };
}
