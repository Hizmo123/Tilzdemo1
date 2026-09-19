"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { generatePin, hashPin } from "@/lib/staff-auth";
import { STAFF_PIN_ROLES } from "@/lib/rbac";

// Roles a PIN staff account may hold now live in @/lib/rbac (STAFF_PIN_ROLES),
// so both server actions and client components can import them. A "use server"
// module can only export async functions.

export type StaffLoginActionState = {
  error?: string;
  createdPin?: string;
  createdName?: string;
};

async function ownerRestaurantId(): Promise<string | null> {
  const { membership } = await getAuthz();
  return membership?.organization.restaurants[0]?.id ?? null;
}

// Confirms a staff account belongs to the caller's restaurant before any write.
async function assertStaffOwned(staffId: string, restaurantId: string) {
  return prisma.staffAccount.findFirst({
    where: { id: staffId, restaurantId },
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(60),
  role: z.enum(STAFF_PIN_ROLES as [Role, ...Role[]]),
});

export async function createStaffLogin(
  _prev: StaffLoginActionState,
  formData: FormData,
): Promise<StaffLoginActionState> {
  const authz = await getAuthz();
  if (!authz.can("staff:manage"))
    return { error: "You don't have permission to manage staff." };

  const restaurantId = await ownerRestaurantId();
  if (!restaurantId) return { error: "Create your restaurant first." };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const pin = generatePin();
  await prisma.staffAccount.create({
    data: {
      restaurantId,
      name: parsed.data.name,
      role: parsed.data.role,
      pinHash: hashPin(pin),
    },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.pin.created",
    resourceType: "StaffAccount",
    metadata: { name: parsed.data.name, role: parsed.data.role },
  });

  revalidatePath("/dashboard/staff/logins");
  // The plaintext PIN is returned once for the owner to hand over; it's not
  // stored and can't be shown again — only reset.
  return { createdPin: pin, createdName: parsed.data.name };
}

export async function resetPin(
  staffId: string,
): Promise<StaffLoginActionState> {
  const authz = await getAuthz();
  if (!authz.can("staff:manage"))
    return { error: "You don't have permission to manage staff." };
  const restaurantId = await ownerRestaurantId();
  if (!restaurantId) return { error: "Restaurant not found." };

  const staff = await assertStaffOwned(staffId, restaurantId);
  if (!staff) return { error: "Staff member not found." };

  const pin = generatePin();
  await prisma.staffAccount.update({
    where: { id: staff.id },
    data: { pinHash: hashPin(pin), failedAttempts: 0, lockedUntil: null },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.pin.reset",
    resourceType: "StaffAccount",
    resourceId: staff.id,
    metadata: { name: staff.name },
  });

  revalidatePath("/dashboard/staff/logins");
  return { createdPin: pin, createdName: staff.name };
}

export async function setStaffActive(staffId: string, active: boolean) {
  const authz = await getAuthz();
  if (!authz.can("staff:manage")) return { error: "Not permitted." };
  const restaurantId = await ownerRestaurantId();
  if (!restaurantId) return { error: "Restaurant not found." };

  const staff = await assertStaffOwned(staffId, restaurantId);
  if (!staff) return { error: "Staff member not found." };

  await prisma.staffAccount.update({
    where: { id: staff.id },
    data: { active },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.pin.availability",
    resourceType: "StaffAccount",
    resourceId: staff.id,
    metadata: { name: staff.name, active },
  });

  revalidatePath("/dashboard/staff/logins");
  return { ok: true as const };
}

export async function changeStaffRole(staffId: string, role: Role) {
  const authz = await getAuthz();
  if (!authz.can("staff:manage")) return { error: "Not permitted." };
  if (!STAFF_PIN_ROLES.includes(role)) return { error: "Invalid role." };
  const restaurantId = await ownerRestaurantId();
  if (!restaurantId) return { error: "Restaurant not found." };

  const staff = await assertStaffOwned(staffId, restaurantId);
  if (!staff) return { error: "Staff member not found." };

  await prisma.staffAccount.update({ where: { id: staff.id }, data: { role } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.pin.role_changed",
    resourceType: "StaffAccount",
    resourceId: staff.id,
    metadata: { name: staff.name, from: staff.role, to: role },
  });

  revalidatePath("/dashboard/staff/logins");
  return { ok: true as const };
}

// Locks (or unlocks, passing null) a KITCHEN account to one prep station —
// see StaffAccount.assignedStation and the kitchen page's server-side
// enforcement of it. Ignored for non-KITCHEN roles: assigning a station to a
// STAFF/OWNER/etc. account does nothing since nothing reads it for them.
export async function changeStaffStation(staffId: string, station: string | null) {
  const authz = await getAuthz();
  if (!authz.can("staff:manage")) return { error: "Not permitted." };
  const restaurantId = await ownerRestaurantId();
  if (!restaurantId) return { error: "Restaurant not found." };

  const staff = await assertStaffOwned(staffId, restaurantId);
  if (!staff) return { error: "Staff member not found." };

  await prisma.staffAccount.update({
    where: { id: staff.id },
    data: { assignedStation: station && station.trim() ? station.trim().slice(0, 24) : null },
  });

  revalidatePath("/dashboard/staff/logins");
  return { ok: true as const };
}

export async function deleteStaffLogin(staffId: string) {
  const authz = await getAuthz();
  if (!authz.can("staff:manage")) return { error: "Not permitted." };
  const restaurantId = await ownerRestaurantId();
  if (!restaurantId) return { error: "Restaurant not found." };

  const staff = await assertStaffOwned(staffId, restaurantId);
  if (!staff) return { error: "Staff member not found." };

  await prisma.staffAccount.delete({ where: { id: staff.id } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.pin.deleted",
    resourceType: "StaffAccount",
    resourceId: staff.id,
    metadata: { name: staff.name },
  });

  revalidatePath("/dashboard/staff/logins");
  return { ok: true as const };
}
