// Admin account-lifecycle mutations — cross-tenant writes that bypass the
// normal tenant boundary, same trust model as lib/admin/queries.ts.
//
// SAFE TO USE ONLY after the caller has already run requirePlatformAdmin()
// (src/lib/platform-admin.ts) in the current request — nothing in this file
// checks that itself. These are plain functions, not server actions; the
// actual "use server" entry points live in
// src/app/admin/orgs/actions.ts, each of which calls requirePlatformAdmin()
// independently before calling anything here.

import { prisma } from "@/lib/prisma";
import type { PlanTier } from "@prisma/client";
import { PLANS } from "@/lib/plans";
import { audit } from "@/lib/audit";

export type AccountActionResult = { ok: true } | { error: string };

async function findOrg(orgId: string) {
  return prisma.organization.findUnique({ where: { id: orgId } });
}

// Admin suspension — distinct from the owner's own self-service
// deactivateAccount() in lib/account.ts, which mails a reactivationToken so
// the owner can lift it themselves. An admin suspension (non-payment, abuse,
// etc.) must NOT be self-liftable, so this deliberately sets deactivatedAt/
// deactivatedByEmail WITHOUT a reactivationToken, and sends no email. Reuses
// the exact same Organization.deactivatedAt field that already blocks
// owner/team dashboard login (dashboard/layout.tsx) and every staff PIN
// login in the org (lib/staff-auth.ts, staff/[slug]/login-actions.ts) — no
// new checkpoint needed.
export async function adminSuspendOrg(
  orgId: string,
  adminUserId: string,
  adminEmail: string,
): Promise<AccountActionResult> {
  const org = await findOrg(orgId);
  if (!org) return { error: "Organisation not found." };

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      deactivatedAt: new Date(),
      deactivatedByEmail: adminEmail,
      planStatus: "suspended",
    },
  });

  await audit({
    organizationId: orgId,
    actorUserId: adminUserId,
    actorEmail: adminEmail,
    action: "admin.suspend_org",
    resourceType: "Organization",
    resourceId: orgId,
    metadata: {
      before: { deactivatedAt: org.deactivatedAt, planStatus: org.planStatus },
      after: { deactivatedAt: "now", planStatus: "suspended" },
    },
  });

  return { ok: true };
}

export async function adminReactivateOrg(
  orgId: string,
  adminUserId: string,
  adminEmail: string,
): Promise<AccountActionResult> {
  const org = await findOrg(orgId);
  if (!org) return { error: "Organisation not found." };

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      deactivatedAt: null,
      deactivatedByEmail: null,
      reactivationToken: null,
      reactivationTokenExpiresAt: null,
      planStatus: "active",
    },
  });

  await audit({
    organizationId: orgId,
    actorUserId: adminUserId,
    actorEmail: adminEmail,
    action: "admin.reactivate_org",
    resourceType: "Organization",
    resourceId: orgId,
    metadata: {
      before: { deactivatedAt: org.deactivatedAt, planStatus: org.planStatus },
      after: { deactivatedAt: null, planStatus: "active" },
    },
  });

  return { ok: true };
}

export async function adminChangePlan(
  orgId: string,
  tier: string,
  adminUserId: string,
  adminEmail: string,
): Promise<AccountActionResult> {
  const validTiers = PLANS.map((p) => p.tier);
  if (!validTiers.includes(tier as PlanTier)) {
    return { error: "That isn't a valid plan." };
  }

  const org = await findOrg(orgId);
  if (!org) return { error: "Organisation not found." };

  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: tier as PlanTier },
  });

  await audit({
    organizationId: orgId,
    actorUserId: adminUserId,
    actorEmail: adminEmail,
    action: "admin.change_plan",
    resourceType: "Organization",
    resourceId: orgId,
    metadata: { before: { plan: org.plan }, after: { plan: tier } },
  });

  return { ok: true };
}

export async function adminSetLapsed(
  orgId: string,
  lapsed: boolean,
  adminUserId: string,
  adminEmail: string,
): Promise<AccountActionResult> {
  const org = await findOrg(orgId);
  if (!org) return { error: "Organisation not found." };

  await prisma.organization.update({
    where: { id: orgId },
    data: { subscriptionLapsedAt: lapsed ? new Date() : null },
  });

  await audit({
    organizationId: orgId,
    actorUserId: adminUserId,
    actorEmail: adminEmail,
    action: lapsed ? "admin.mark_lapsed" : "admin.clear_lapsed",
    resourceType: "Organization",
    resourceId: orgId,
    metadata: {
      before: { subscriptionLapsedAt: org.subscriptionLapsedAt },
      after: { subscriptionLapsedAt: lapsed ? "now" : null },
    },
  });

  return { ok: true };
}

export async function adminClearDeletionRequest(
  orgId: string,
  adminUserId: string,
  adminEmail: string,
): Promise<AccountActionResult> {
  const org = await findOrg(orgId);
  if (!org) return { error: "Organisation not found." };

  await prisma.organization.update({
    where: { id: orgId },
    data: { deletionRequestedAt: null, deletionRequestedByEmail: null },
  });

  await audit({
    organizationId: orgId,
    actorUserId: adminUserId,
    actorEmail: adminEmail,
    action: "admin.clear_deletion_request",
    resourceType: "Organization",
    resourceId: orgId,
    metadata: {
      before: {
        deletionRequestedAt: org.deletionRequestedAt,
        deletionRequestedByEmail: org.deletionRequestedByEmail,
      },
      after: { deletionRequestedAt: null, deletionRequestedByEmail: null },
    },
  });

  return { ok: true };
}
