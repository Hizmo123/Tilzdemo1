"use server";

import { revalidatePath } from "next/cache";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan, type Permission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  addItemsForTable,
  staffCloseBill,
  voidBillItem,
  compBillItem,
  setBillDiscount,
  moveBill,
  mergeBills,
  refundBillPayment,
  type AddItem,
} from "@/lib/bills";
import { audit } from "@/lib/audit";
import { getEntitlements } from "@/lib/entitlements";

// Staff takes an order at a table: adds items to that table's open bill. Prices
// come from the DB (never the client). Authorized by the staff session, scoped
// to the staff member's own venue, and gated on orders:manage.
export async function staffAddItems(
  slug: string,
  tableId: string,
  items: AddItem[],
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't take orders." };

  // Confirm the table belongs to this staff member's restaurant.
  const table = await prisma.table.findFirst({
    where: {
      id: tableId,
      active: true,
      location: { restaurantId: session.restaurant.id },
    },
  });
  if (!table) return { error: "Table not found." };

  // Lapsed-subscription grace period (spec B4) — same rule as the customer
  // ordering path: existing service keeps running, only new ordering stops,
  // and only once the grace period has actually passed.
  const ent = await getEntitlements(session.restaurant.organizationId);
  if (ent.orderingBlocked) {
    return { error: "This venue can't take new orders right now — contact the owner." };
  }

  const res = await addItemsForTable(
    {
      tableId: table.id,
      restaurantId: session.restaurant.id,
      currency: session.restaurant.currency,
    },
    items,
    "STAFF",
  );
  if ("error" in res) return res;

  revalidatePath(`/staff/${slug}/table/${tableId}`);
  revalidatePath(`/staff/${slug}/home`);
  return { ok: true as const };
}

// Staff records payment for the whole remaining balance (counter / cash),
// closing the bill. Used in waiter-service mode where customers don't pay by
// phone. Gated on orders:manage and scoped to the staff member's venue.
export async function markBillPaid(slug: string, tableId: string) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't take payments." };

  const table = await prisma.table.findFirst({
    where: { id: tableId, location: { restaurantId: session.restaurant.id } },
  });
  if (!table) return { error: "Table not found." };

  const res = await staffCloseBill(table.id, session.restaurant.id);
  if ("error" in res) return res;

  revalidatePath(`/staff/${slug}/table/${tableId}`);
  revalidatePath(`/staff/${slug}/home`);
  return { ok: true as const };
}

// ---- Bill adjustments (void / comp / discount) -----------------------------

// `permission` defaults to "orders:manage" (taking/serving orders — every
// caller below except comp/void/discount). Comp, void and an arbitrary
// discount can zero out a bill — the same cash-handling risk closing the
// drawer carries, which is gated on "payments:refund" (manager/owner/admin,
// not plain STAFF) — so those three callers pass that permission explicitly
// instead of the default. Picking the stricter of the two available bars
// deliberately: "orders:manage" (what STAFF holds) was the wrong tier for an
// action that can hand out free food or erase a bill's total.
async function authedStaff(slug: string, permission: Permission = "orders:manage") {
  const session = await requireStaffForSlug(slug);
  if (!session) return null;
  if (!roleCan(session.staff.role, permission)) return null;
  return session;
}

export async function staffVoidItem(
  slug: string,
  tableId: string,
  itemId: string,
  voided: boolean,
) {
  const session = await authedStaff(slug, "payments:refund");
  if (!session) return { error: "Not permitted." };
  const res = await voidBillItem(itemId, session.restaurant.id, voided);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/table/${tableId}`);
  return { ok: true as const };
}

export async function staffCompItem(
  slug: string,
  tableId: string,
  itemId: string,
  comped: boolean,
) {
  const session = await authedStaff(slug, "payments:refund");
  if (!session) return { error: "Not permitted." };
  const res = await compBillItem(itemId, session.restaurant.id, comped);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/table/${tableId}`);
  return { ok: true as const };
}

export async function staffSetDiscount(
  slug: string,
  tableId: string,
  billId: string,
  discountCents: number,
) {
  const session = await authedStaff(slug, "payments:refund");
  if (!session) return { error: "Not permitted." };
  const res = await setBillDiscount(billId, session.restaurant.id, discountCents);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/table/${tableId}`);
  return { ok: true as const };
}

// ---- Move / merge -----------------------------------------------------------

export async function staffMoveBill(slug: string, billId: string, toTableId: string) {
  const session = await authedStaff(slug);
  if (!session) return { error: "Not permitted." };
  const res = await moveBill(session.restaurant.id, billId, toTableId);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/home`);
  return { ok: true as const };
}

export async function staffMergeBills(slug: string, sourceBillId: string, targetBillId: string) {
  const session = await authedStaff(slug);
  if (!session) return { error: "Not permitted." };
  const res = await mergeBills(session.restaurant.id, sourceBillId, targetBillId);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/home`);
  return { ok: true as const };
}

// ---- Refunds -----------------------------------------------------------------

export async function staffRefundPayment(
  slug: string,
  tableId: string,
  paymentId: string,
  amountCents: number,
  reason: string,
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "payments:refund"))
    return { error: "Your role can't issue refunds." };

  // Staff PIN accounts have no email — `name` is the closest identifier and
  // is what shows up in the refund/audit trail for a PIN-authenticated actor.
  const res = await refundBillPayment(paymentId, session.restaurant.id, amountCents, reason, {
    userId: session.staff.id,
    email: session.staff.name,
  });
  if ("error" in res) return res;

  await audit({
    organizationId: session.restaurant.organizationId,
    actorUserId: session.staff.id,
    actorEmail: session.staff.name,
    action: "payment.refunded",
    resourceType: "Payment",
    resourceId: paymentId,
    metadata: { amountCents, reason, tableId, via: "staff_pin" },
  });

  revalidatePath(`/staff/${slug}/table/${tableId}`);
  return { ok: true as const };
}
