"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthz, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getPublishReadiness, canCreateVenue } from "@/lib/entitlements";

const createRestaurantSchema = z.object({
  restaurantName: z.string().trim().min(2, "Enter a restaurant name.").max(80),
  locationName: z.string().trim().min(2, "Enter a location name.").max(80),
});

export type CreateRestaurantState = { error?: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export async function createRestaurant(
  _prev: CreateRestaurantState,
  formData: FormData,
): Promise<CreateRestaurantState> {
  const user = await requireUser();

  const parsed = createRestaurantSchema.safeParse({
    restaurantName: formData.get("restaurantName"),
    locationName: formData.get("locationName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { restaurantName, locationName } = parsed.data;

  // This form only renders for a user who ALREADY has a membership but no
  // restaurant under it yet (dashboard/page.tsx's "has an org but somehow no
  // restaurant/location" edge case) — a genuinely membership-less user is
  // redirected to /onboarding before ever reaching it. Which means every
  // real call here has an existing org to check, and previously never did:
  // completeOnboardingForExistingOrg (the OTHER path that creates an
  // additional restaurant under an existing org) gates every venue past the
  // first on canCreateVenue; this path let ANY signed-in user with a
  // membership mint an unlimited number of further organizations — each a
  // brand-new LITE org, never counted against any plan's venue limit — by
  // resubmitting this form. Same gate, same reasoning, applied here.
  const existingMembership = await prisma.membership.findFirst({ where: { userId: user.id } });
  if (existingMembership) {
    const check = await canCreateVenue(existingMembership.organizationId);
    if (!check.allowed) return { error: check.reason };
  }

  // Ensure a globally-unique slug by appending a short suffix on collision.
  const base = slugify(restaurantName) || "venue";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.restaurant.findUnique({ where: { slug } });
    if (!existing) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const organizationId = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: restaurantName },
    });
    await tx.membership.create({
      data: {
        userId: user.id,
        email: user.email ?? "",
        organizationId: org.id,
        role: "OWNER",
      },
    });
    await tx.restaurant.create({
      data: {
        organizationId: org.id,
        name: restaurantName,
        slug,
        locations: { create: { name: locationName } },
      },
    });
    return org.id;
  });

  await audit({
    organizationId,
    actorUserId: user.id,
    actorEmail: user.email ?? "",
    action: "restaurant.created",
    resourceType: "Restaurant",
    metadata: { name: restaurantName },
  });

  revalidatePath("/dashboard");
  return {};
}

export type PublishState = { error?: string; ok?: boolean };

// Flips a restaurant live — gates /v/[token] and /m/[slug] (see
// lib/entitlements.ts's Restaurant.published comment). Refuses outright
// unless getPublishReadiness says so — under the mock billing model that's
// "subscribed" for every tier, PLUS an active Square connection for
// CONNECT specifically (it has no subscription to be "active" instead of).
// No payment provider is ever called here; this is the mock path the whole
// plan model runs on until real billing lands.
export async function publishRestaurant(): Promise<PublishState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) {
    return { error: "Only an owner or admin can publish the venue." };
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) return { error: "Create your restaurant first." };

  const readiness = await getPublishReadiness(authz.membership!.organizationId);
  if (!readiness.ready) {
    return {
      error:
        readiness.reason === "square_disconnected"
          ? "This venue needs an active Square connection before it can go live. Reconnect Square in Settings → Integrations first."
          : "This venue needs an active plan before it can go live. Confirm a plan on the Billing page first.",
    };
  }

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { published: true },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "restaurant.published",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

// Takes a live venue back offline — the reverse of publishRestaurant. No
// subscription check needed to go offline, only to go live.
export async function unpublishRestaurant(): Promise<PublishState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) return { error: "Create your restaurant first." };

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { published: false },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "restaurant.unpublished",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
