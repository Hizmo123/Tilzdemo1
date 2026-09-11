"use server";

import { redirect } from "next/navigation";
import { clearStaffSession, requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import {
  updateRequestStatus,
  type RequestStatusName,
} from "@/lib/requests";
import { revalidatePath } from "next/cache";

export async function staffSignOut(slug: string) {
  await clearStaffSession();
  redirect(`/staff/${slug}`);
}

// Staff acknowledges or completes a customer request. Scoped to the venue, gated
// on orders:manage (floor staff).
export async function updateRequest(
  slug: string,
  requestId: string,
  to: RequestStatusName,
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "orders:manage"))
    return { error: "Your role can't handle requests." };

  const res = await updateRequestStatus(requestId, session.restaurant.id, to);
  if ("error" in res) return res;

  revalidatePath(`/staff/${slug}/home`);
  return { ok: true as const };
}
