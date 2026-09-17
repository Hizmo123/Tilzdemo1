"use server";

import { revalidatePath } from "next/cache";
import { getAuthz } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requestAccountDeletion, cancelAccountDeletion, deactivateAccount } from "@/lib/account";

export type PrivacyState = { error?: string; ok?: boolean };

// Account deletion is a step above ordinary settings changes — gated on
// OWNER specifically, not just settings:manage (which ADMIN also holds).
export async function requestDeletionAction(confirmName: string): Promise<PrivacyState> {
  const authz = await getAuthz();
  const org = authz.membership?.organization;
  if (!org) return { error: "Not found." };
  if (authz.role !== "OWNER") return { error: "Only the owner can request account deletion." };
  if (confirmName.trim() !== org.name) {
    return { error: "Type your venue's name exactly to confirm." };
  }

  await requestAccountDeletion(org.id, authz.user.email ?? "");

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "account.deletion_requested",
  });

  revalidatePath("/dashboard/settings/privacy");
  return { ok: true };
}

// Same OWNER-only gate as deletion — this blocks the whole team's access and
// cancels the subscription, not a decision an admin should be able to make
// unilaterally.
export async function deactivateAccountAction(confirmName: string): Promise<PrivacyState> {
  const authz = await getAuthz();
  const org = authz.membership?.organization;
  if (!org) return { error: "Not found." };
  if (authz.role !== "OWNER") return { error: "Only the owner can deactivate the account." };
  if (confirmName.trim() !== org.name) {
    return { error: "Type your venue's name exactly to confirm." };
  }

  const result = await deactivateAccount(org.id, authz.user.email ?? "");
  if ("error" in result) return { error: result.error };

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "account.deactivated",
  });

  // The user is about to be locked out of the dashboard entirely (that's the
  // point) — nothing to revalidate them into.
  return { ok: true };
}

export async function cancelDeletionAction(): Promise<PrivacyState> {
  const authz = await getAuthz();
  const org = authz.membership?.organization;
  if (!org) return { error: "Not found." };
  if (authz.role !== "OWNER") return { error: "Only the owner can cancel a deletion request." };

  await cancelAccountDeletion(org.id);

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "account.deletion_cancelled",
  });

  revalidatePath("/dashboard/settings/privacy");
  return { ok: true };
}
