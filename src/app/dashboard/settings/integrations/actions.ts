"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getLocations } from "@/lib/square/client";
import { revoke } from "@/lib/square/oauth";

async function requireConnection() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant || !authz.can("settings:manage")) {
    throw new Error("Not authorised.");
  }
  const connection = await prisma.squareConnection.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!connection) throw new Error("No Square connection for this venue.");
  return { authz, restaurant, connection };
}

export async function listSquareLocations() {
  const { connection } = await requireConnection();
  const locations = await getLocations(connection);
  return locations.map((l) => ({ id: l.id ?? "", name: l.name ?? l.id ?? "Location" }));
}

export async function setSquareLocation(locationId: string) {
  const { restaurant } = await requireConnection();
  await prisma.squareConnection.update({
    where: { restaurantId: restaurant.id },
    data: { locationId },
  });
  revalidatePath("/dashboard/settings/integrations");
}

export async function disconnectSquare() {
  const { authz, restaurant, connection } = await requireConnection();

  // Best-effort: still remove the local connection even if Square's revoke
  // call fails, so a stuck/expired token can never leave the owner unable to
  // disconnect from Tillz's side.
  try {
    await revoke(connection);
  } catch {
    // Intentionally ignored — see comment above.
  }

  await prisma.squareConnection.delete({ where: { restaurantId: restaurant.id } });

  await audit({
    organizationId: restaurant.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "square.disconnected",
    resourceType: "Restaurant",
    resourceId: restaurant.id,
  });

  revalidatePath("/dashboard/settings/integrations");
}
