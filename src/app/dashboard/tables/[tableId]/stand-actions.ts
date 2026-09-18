"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export type StandActionState = { error?: string; ok?: boolean };

// Confirms a stand belongs to the caller's own restaurant before any
// mutation — never trust a standId from the client beyond that.
async function ownedStand(standId: string, restaurantId: string) {
  return prisma.tillzStand.findFirst({ where: { id: standId, restaurantId } });
}

// Moves a stand to a different table within the SAME restaurant. No
// reprint needed — /s/<id> re-reads the stand's tableId on every scan (see
// lib/stands.ts#resolveStand), so the very next scan resolves to the new
// table.
export async function moveStand(standId: string, toTableId: string): Promise<StandActionState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) {
    return { error: "Only an owner or admin can move a stand." };
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) return { error: "Create your restaurant first." };

  const stand = await ownedStand(standId, restaurant.id);
  if (!stand) return { error: "Stand not found." };

  const targetTable = await prisma.table.findFirst({
    where: { id: toTableId, location: { restaurantId: restaurant.id } },
  });
  if (!targetTable) return { error: "That table wasn't found." };

  await prisma.tillzStand.update({ where: { id: stand.id }, data: { tableId: targetTable.id } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "stand.moved",
    resourceType: "TillzStand",
    resourceId: stand.id,
    metadata: { toTableId: targetTable.id, toTableLabel: targetTable.label },
  });

  revalidatePath("/dashboard/tables");
  return { ok: true };
}

// Instantly stops the stand's QR resolving anywhere — reportedly-lost cards
// should never keep working. Owner/admin only, same gate as moving a stand.
export async function deactivateStand(standId: string): Promise<StandActionState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) {
    return { error: "Only an owner or admin can deactivate a stand." };
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) return { error: "Create your restaurant first." };

  const stand = await ownedStand(standId, restaurant.id);
  if (!stand) return { error: "Stand not found." };

  await prisma.tillzStand.update({ where: { id: stand.id }, data: { status: "DEACTIVATED" } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "stand.deactivated",
    resourceType: "TillzStand",
    resourceId: stand.id,
  });

  revalidatePath("/dashboard/tables");
  return { ok: true };
}
