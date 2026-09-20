"use server";

import { revalidatePath } from "next/cache";
import type { TenderType } from "@prisma/client";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  createCounterBill,
  addItemsToCounterBill,
  staffCloseBillById,
  type AddItem,
} from "@/lib/bills";
import { getEntitlements } from "@/lib/entitlements";

function revalidateCounter(slug: string, billId?: string) {
  revalidatePath(`/staff/${slug}/counter`);
  if (billId) revalidatePath(`/staff/${slug}/counter/${billId}`);
  revalidatePath(`/staff/${slug}/home`);
}

// Starts a new counter sale for the given location. Gated on orders:manage —
// the same permission the table order flow uses — and scoped to the staff
// member's own venue/location.
export async function startCounterSale(slug: string, locationId: string) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't take orders." };

  const location = await prisma.location.findFirst({
    where: { id: locationId, restaurantId: session.restaurant.id },
  });
  if (!location) return { error: "Location not found." };

  const res = await createCounterBill(session.restaurant.id, location.id);
  if ("error" in res) return res;

  revalidateCounter(slug);
  return { ok: true as const, billId: res.billId };
}

// Adds items to an open counter sale. Reuses the exact same
// addItemsToCounterBill core the counter lib exposes — prices always come
// from the DB, never the client.
export async function addCounterItems(slug: string, billId: string, items: AddItem[]) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't take orders." };

  // Lapsed-subscription grace period (spec B4) — same rule as the table
  // order path: existing service keeps running, only new ordering stops.
  const ent = await getEntitlements(session.restaurant.organizationId);
  if (ent.orderingBlocked) {
    return { error: "This venue can't take new orders right now — contact the owner." };
  }

  const res = await addItemsToCounterBill(billId, session.restaurant.id, items);
  if ("error" in res) return res;

  revalidateCounter(slug, billId);
  return { ok: true as const };
}

// Takes payment for a counter sale (mock "counter"/cash path — see
// staffCloseBillById), closing it. After this the sale drops off the open
// list. tenderType is required — staffCloseBillById itself rejects CASH
// with no open drawer session for the sale's location.
export async function closeCounterSale(
  slug: string,
  billId: string,
  tenderType: TenderType,
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't take payment." };

  const res = await staffCloseBillById(billId, session.restaurant.id, tenderType);
  if ("error" in res) return res;

  revalidateCounter(slug, billId);
  return { ok: true as const };
}
