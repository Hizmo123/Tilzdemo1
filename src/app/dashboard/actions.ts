"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

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
