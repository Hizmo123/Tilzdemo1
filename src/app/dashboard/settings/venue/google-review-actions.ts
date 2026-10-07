"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { normalizeGoogleReviewUrl } from "@/lib/google-review";

export type GoogleReviewState = { error?: string; ok?: boolean };

async function currentRestaurant() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0] ?? null;
  return { authz, restaurant };
}

function revalidate() {
  revalidatePath("/dashboard/settings/venue");
  revalidatePath("/dashboard/settings");
}

// Available on every plan, including Lite — a review prompt is a benefit to
// the venue, not a paid feature, so this is never gated behind entitlements
// the way e.g. priority support is.
export async function setGoogleReviewUrl(raw: string): Promise<GoogleReviewState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  const result = normalizeGoogleReviewUrl(raw);
  if (!result.ok) return { error: result.error };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { googleReviewUrl: result.url },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "restaurant.google_review_url_set",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
  });

  revalidate();
  return { ok: true };
}

export async function removeGoogleReviewUrl(): Promise<GoogleReviewState> {
  const { authz, restaurant } = await currentRestaurant();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  if (!restaurant) return { error: "Create your restaurant first." };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { googleReviewUrl: null },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "restaurant.google_review_url_removed",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
  });

  revalidate();
  return { ok: true };
}
