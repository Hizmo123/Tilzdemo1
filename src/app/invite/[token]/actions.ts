"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export type AcceptResult = { error?: string; ok?: boolean };

// Accepts a staff invite for the currently signed-in user. The invite carries
// the role; the user's identity comes from their Supabase session, never the
// client. Idempotent-ish: an already-accepted/expired/revoked invite is refused.
export async function acceptInvite(token: string): Promise<AcceptResult> {
  const user = await requireUser();

  const invite = await prisma.staffInvite.findUnique({ where: { token } });
  if (!invite) return { error: "This invite link is not valid." };
  if (invite.status === "REVOKED")
    return { error: "This invite has been revoked." };
  if (invite.status === "ACCEPTED")
    return { error: "This invite has already been used." };
  if (invite.expiresAt < new Date())
    return { error: "This invite has expired. Ask for a new one." };

  // Create the membership (or no-op if somehow already a member), then mark the
  // invite accepted — in one transaction.
  await prisma.$transaction(async (tx) => {
    const already = await tx.membership.findFirst({
      where: { organizationId: invite.organizationId, userId: user.id },
    });
    if (!already) {
      await tx.membership.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          email: user.email ?? invite.email,
          role: invite.role,
        },
      });
    }
    await tx.staffInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  });

  await audit({
    organizationId: invite.organizationId,
    actorUserId: user.id,
    actorEmail: user.email ?? "",
    action: "staff.member.joined",
    resourceType: "Membership",
    metadata: { email: user.email, role: invite.role },
  });

  return { ok: true };
}
