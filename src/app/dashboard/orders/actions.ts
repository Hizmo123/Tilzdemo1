"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { advanceOrderStatus, type OrderStatusName } from "@/lib/bills";

// Owner/admin/manager advancing a ticket from the dashboard Orders view.
export async function advanceOrderFromDashboard(
  orderId: string,
  to: OrderStatusName,
) {
  const authz = await getAuthz();
  if (!authz.can("kitchen:manage")) return { error: "Not permitted." };
  const restaurantId = authz.membership?.organization.restaurants[0]?.id;
  if (!restaurantId) return { error: "Restaurant not found." };

  const res = await advanceOrderStatus(orderId, restaurantId, to);
  if ("error" in res) return res;

  revalidatePath("/dashboard/orders");
  return { ok: true as const };
}
