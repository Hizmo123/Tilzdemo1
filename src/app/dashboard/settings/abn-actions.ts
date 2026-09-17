"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { lookupAbn } from "@/lib/abr";

async function currentRestaurant() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0] ?? null;
  return { authz, restaurant };
}

export type AbnLookupState =
  | { error: string }
  | { ok: true; abn: string; entityName: string; abnStatus: string; gstRegistered: boolean; test: boolean };

// Preview only — nothing is saved until the owner confirms it's actually
// their business (confirmAbnVerification below).
export async function lookupAbnAction(abn: string): Promise<AbnLookupState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };
  return lookupAbn(abn);
}

export type AbnConfirmState = { error?: string; ok?: boolean };

// Re-runs the lookup server-side rather than trusting whatever the client
// showed from the preview — the same "never trust client state for a write"
// rule as everywhere else money- or identity-adjacent in this app.
export async function confirmAbnVerification(abn: string): Promise<AbnConfirmState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const result = await lookupAbn(abn);
  if ("error" in result) return { error: result.error };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      abn: result.abn,
      abnVerifiedAt: new Date(),
      abnVerifiedValue: result.abn,
      abnVerifiedName: result.entityName,
      abnVerifiedGst: result.gstRegistered,
    },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "restaurant.abn_verified",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
    metadata: { abn: result.abn, entityName: result.entityName, test: result.test },
  });

  revalidatePath("/dashboard/settings/venue");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
