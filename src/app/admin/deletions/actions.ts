"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { purgeDeletedOrganization, type PurgeCounts } from "@/lib/admin/account-purge";
import { PURGE_CONFIRMATION } from "@/lib/admin/purge-confirmation";

export type PurgeActionState = { error?: string; ok?: boolean; counts?: PurgeCounts };

// Hard-deletes a self-deleted organisation's retained financial records.
// requirePlatformAdmin() first, independently of the /admin layout (see
// lib/platform-admin.ts). The typed confirmation is checked HERE,
// server-side and case-sensitively — the client's disabled button is only a
// convenience, and this action can be called directly. The eligibility rule
// (deleted AND retention date passed) is enforced again inside
// purgeDeletedOrganization, not just hidden by the page.
export async function purgeDeletedOrgAction(orgId: string, confirmation: string): Promise<PurgeActionState> {
  const { userId } = await requirePlatformAdmin();

  if (confirmation !== PURGE_CONFIRMATION) {
    return { error: `Type ${PURGE_CONFIRMATION} exactly (capitals) to confirm.` };
  }

  const result = await purgeDeletedOrganization(orgId, userId);
  if ("error" in result) return { error: result.error };

  revalidatePath("/admin/deletions");
  revalidatePath("/admin/orgs");
  revalidatePath("/admin/accounts");
  return { ok: true, counts: result.counts };
}
