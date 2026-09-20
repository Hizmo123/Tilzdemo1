"use server";

import { revalidatePath } from "next/cache";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import {
  openSession,
  recordMovement,
  closeSession,
  getZReport,
  type ZReport,
} from "@/lib/cash-drawer";

function revalidateRegister(slug: string) {
  revalidatePath(`/staff/${slug}/register`);
  revalidatePath(`/staff/${slug}/register/history`);
  revalidatePath(`/staff/${slug}/counter`);
  revalidatePath(`/staff/${slug}/home`);
}

// Opening/operating the drawer (open, paid-in/out, viewing the live running
// total) stays available to counter staff — orders:manage, the same
// permission the table order flow and the counter screen use. Only actually
// CLOSING the drawer (and viewing a Z-report, including history) is
// manager-gated — see closeDrawer/previewZReport's stricter check below and
// register/history's own page gate.
export async function openDrawer(
  slug: string,
  locationId: string,
  openingFloatCents: number,
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't open the drawer." };

  const res = await openSession(
    session.restaurant.id,
    locationId,
    { id: session.staff.id, name: session.staff.name },
    openingFloatCents,
  );
  if ("error" in res) return res;

  revalidateRegister(slug);
  return { ok: true as const, sessionId: res.data.id };
}

export async function addCashMovement(
  slug: string,
  cashSessionId: string,
  type: "PAID_IN" | "PAID_OUT",
  amountCents: number,
  reason: string,
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't record a drawer movement." };

  const res = await recordMovement(
    cashSessionId,
    session.restaurant.id,
    type,
    amountCents,
    reason,
    { id: session.staff.id, name: session.staff.name },
  );
  if ("error" in res) return res;

  revalidateRegister(slug);
  return { ok: true as const };
}

// Read-only live figures for the register screen's running summary (opening
// float, sales by tender so far, expected cash) — available to whoever can
// operate the drawer, not just a manager. The stricter manager-only gate is
// specifically on actually closing (closeDrawer) and on history.
export async function previewZReport(slug: string, cashSessionId: string) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't view the drawer summary." };

  const report = await getZReport(cashSessionId, session.restaurant.id);
  if (!report) return { error: "Session not found." };
  return { ok: true as const, report };
}

// Closing the drawer (and therefore finalising its Z-report) is manager-
// level — reuses payments:refund, the closest existing "manager handles
// money" permission (OWNER/ADMIN/MANAGER, not general STAFF/KITCHEN), per
// this task's instruction to reuse an existing perm rather than invent a
// role. Same permission register/history's own page gate uses.
export async function closeDrawer(
  slug: string,
  cashSessionId: string,
  countedCashCents: number,
): Promise<{ ok: true; report: ZReport } | { error: string }> {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "payments:refund"))
    return { error: "Your role can't close the drawer." };

  const res = await closeSession(
    cashSessionId,
    session.restaurant.id,
    { id: session.staff.id, name: session.staff.name },
    countedCashCents,
  );
  if ("error" in res) return res;

  revalidateRegister(slug);
  return { ok: true as const, report: res.data };
}

