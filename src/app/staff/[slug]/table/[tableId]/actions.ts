"use server";

import { revalidatePath } from "next/cache";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  addItemsForTable,
  staffCloseBill,
  voidBillItem,
  compBillItem,
  setBillDiscount,
  type AddItem,
} from "@/lib/bills";

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

async function authedStaff(slug: string) {
  const session = await requireStaffForSlug(slug);
  if (!session) return null;
  if (!roleCan(session.staff.role, "orders:manage")) return null;
  return session;
}

export async function staffVoidItem(
  slug: string,
  tableId: string,
  itemId: string,
  voided: boolean,
) {
  const session = await authedStaff(slug);
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
  const session = await authedStaff(slug);
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
  const session = await authedStaff(slug);
  if (!session) return { error: "Not permitted." };
  const res = await setBillDiscount(billId, session.restaurant.id, discountCents);
  if ("error" in res) return res;
  revalidatePath(`/staff/${slug}/table/${tableId}`);
  return { ok: true as const };
}
