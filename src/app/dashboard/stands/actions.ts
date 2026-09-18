"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthz, requireActiveLocation } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { placeStandOrder } from "@/lib/stand-orders";

export type StandOrderActionState = { error?: string; success?: boolean };

const schema = z.object({
  tableIds: z.array(z.string().min(1)).min(1, "Pick at least one table."),
  shippingName: z.string().trim().min(1, "Enter a recipient name.").max(120),
  shippingAddress: z.string().trim().min(1, "Enter a street address.").max(200),
  shippingSuburb: z.string().trim().min(1, "Enter a suburb.").max(100),
  shippingState: z.string().trim().min(1, "Enter a state.").max(10),
  shippingPostcode: z.string().trim().min(1, "Enter a postcode.").max(10),
});

export async function orderStands(
  _prev: StandOrderActionState,
  formData: FormData,
): Promise<StandOrderActionState> {
  const authz = await getAuthz();
  if (!authz.can("tables:manage"))
    return { error: "You don't have permission to order stands." };
  if (!authz.membership) return { error: "No organization found." };

  const { restaurant } = await requireActiveLocation();

  const parsed = schema.safeParse({
    tableIds: formData.getAll("tableIds"),
    shippingName: formData.get("shippingName"),
    shippingAddress: formData.get("shippingAddress"),
    shippingSuburb: formData.get("shippingSuburb"),
    shippingState: formData.get("shippingState"),
    shippingPostcode: formData.get("shippingPostcode"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await placeStandOrder({
    organizationId: authz.membership.organizationId,
    restaurantId: restaurant.id,
    ...parsed.data,
  });
  if ("error" in result) return { error: result.error };

  await audit({
    organizationId: authz.membership.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "stand_order.placed",
    resourceType: "StandOrder",
    resourceId: result.orderId,
    metadata: { tableCount: String(parsed.data.tableIds.length) },
  });

  revalidatePath("/dashboard/stands");
  return { success: true };
}
