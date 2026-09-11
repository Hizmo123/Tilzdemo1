"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { ASSIGNABLE_ROLES } from "@/lib/rbac";
import { appBaseUrl } from "@/lib/urls";

export type StaffActionState = { error?: string; inviteUrl?: string };

const INVITE_TTL_DAYS = 7;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(ASSIGNABLE_ROLES as [Role, ...Role[]]),
});

// Creates a pending invite. Email delivery isn't wired yet (needs a transactional
// email provider — deferred), so the accept link is returned for the owner to
// share manually (spec §85 flags email as a production integration point).
export async function inviteStaff(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const authz = await getAuthz();
  if (!authz.can("staff:manage"))
    return { error: "You don't have permission to manage staff." };

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const organizationId = authz.membership!.organizationId;

  const existing = await prisma.membership.findFirst({
    where: { organizationId, email: parsed.data.email },
  });
  if (existing) return { error: "That email is already a member." };

  const token = generateToken(16);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.staffInvite.create({
    data: {
      organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      invitedByEmail: authz.user.email ?? "",
      expiresAt,
    },
  });

  await audit({
    organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.invited",
    resourceType: "StaffInvite",
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/dashboard/staff");
  return { inviteUrl: `${appBaseUrl()}/invite/${token}` };
}

export async function revokeInvite(inviteId: string): Promise<StaffActionState> {
  const authz = await getAuthz();
  if (!authz.can("staff:manage"))
    return { error: "You don't have permission to manage staff." };

  const invite = await prisma.staffInvite.findFirst({
    where: { id: inviteId, organizationId: authz.membership!.organizationId },
  });
  if (!invite) return { error: "Invite not found." };

  await prisma.staffInvite.update({
    where: { id: invite.id },
    data: { status: "REVOKED" },
  });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.invite.revoked",
    resourceType: "StaffInvite",
    resourceId: invite.id,
    metadata: { email: invite.email },
  });

  revalidatePath("/dashboard/staff");
  return {};
}

export async function removeMember(
  membershipId: string,
): Promise<StaffActionState> {
  const authz = await getAuthz();
  if (!authz.can("staff:manage"))
    return { error: "You don't have permission to manage staff." };

  const member = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: authz.membership!.organizationId },
  });
  if (!member) return { error: "Member not found." };
  if (member.role === "OWNER") return { error: "The owner can't be removed." };
  if (member.userId === authz.user.id)
    return { error: "You can't remove yourself." };

  await prisma.membership.delete({ where: { id: member.id } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.member.removed",
    resourceType: "Membership",
    resourceId: member.id,
    metadata: { email: member.email, role: member.role },
  });

  revalidatePath("/dashboard/staff");
  return {};
}

export async function changeMemberRole(
  membershipId: string,
  role: Role,
): Promise<StaffActionState> {
  const authz = await getAuthz();
  if (!authz.can("staff:manage"))
    return { error: "You don't have permission to manage staff." };

  if (!ASSIGNABLE_ROLES.includes(role))
    return { error: "That role can't be assigned." };

  const member = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: authz.membership!.organizationId },
  });
  if (!member) return { error: "Member not found." };
  if (member.role === "OWNER") return { error: "The owner's role is fixed." };
  if (member.userId === authz.user.id)
    return { error: "You can't change your own role." };

  await prisma.membership.update({ where: { id: member.id }, data: { role } });

  await audit({
    organizationId: authz.membership!.organizationId,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "staff.member.role_changed",
    resourceType: "Membership",
    resourceId: member.id,
    metadata: { email: member.email, from: member.role, to: role },
  });

  revalidatePath("/dashboard/staff");
  return {};
}
