"use server";

import { revalidatePath } from "next/cache";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { setMenuItemAvailable } from "@/lib/bills";

// Staff marks a menu item sold-out / available. Authorized by the staff session,
// scoped to their venue, gated on menu:availability.
export async function staffSetAvailable(
  slug: string,
  itemId: string,
  available: boolean,
) {
  const session = await requireStaffForSlug(slug);
  if (!session) return { error: "Your session has ended. Please sign in again." };
  if (!roleCan(session.staff.role, "menu:availability"))
    return { error: "Your role can't change the menu." };

  const res = await setMenuItemAvailable(itemId, session.restaurant.id, available);
  if ("error" in res) return res;

  revalidatePath(`/staff/${slug}/menu`);
  return { ok: true as const };
}
