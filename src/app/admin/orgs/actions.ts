"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import {
  adminSuspendOrg,
  adminReactivateOrg,
  adminChangePlan,
  adminSetLapsed,
  adminClearDeletionRequest,
  type AccountActionResult,
} from "@/lib/admin/account-actions";

async function adminEmail(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? "unknown";
}

function revalidateAll(orgId: string) {
  revalidatePath("/admin/orgs");
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/admin/accounts");
}

export async function suspendOrgAction(orgId: string): Promise<AccountActionResult> {
  const { userId } = await requirePlatformAdmin(); // re-checked independently of the layout — see lib/platform-admin.ts
  const email = await adminEmail();
  const result = await adminSuspendOrg(orgId, userId, email);
  revalidateAll(orgId);
  return result;
}

export async function reactivateOrgAction(orgId: string): Promise<AccountActionResult> {
  const { userId } = await requirePlatformAdmin();
  const email = await adminEmail();
  const result = await adminReactivateOrg(orgId, userId, email);
  revalidateAll(orgId);
  return result;
}

export async function changePlanAction(
  orgId: string,
  tier: string,
): Promise<AccountActionResult> {
  const { userId } = await requirePlatformAdmin();
  const email = await adminEmail();
  const result = await adminChangePlan(orgId, tier, userId, email);
  revalidateAll(orgId);
  return result;
}

export async function setLapsedAction(
  orgId: string,
  lapsed: boolean,
): Promise<AccountActionResult> {
  const { userId } = await requirePlatformAdmin();
  const email = await adminEmail();
  const result = await adminSetLapsed(orgId, lapsed, userId, email);
  revalidateAll(orgId);
  return result;
}

export async function clearDeletionRequestAction(
  orgId: string,
): Promise<AccountActionResult> {
  const { userId } = await requirePlatformAdmin();
  const email = await adminEmail();
  const result = await adminClearDeletionRequest(orgId, userId, email);
  revalidateAll(orgId);
  return result;
}
