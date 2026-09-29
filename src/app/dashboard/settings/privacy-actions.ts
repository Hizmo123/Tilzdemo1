"use server";

import { getAuthz } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { executeAccountDeletion } from "@/lib/account";

export type PrivacyState = { error?: string; ok?: boolean };

// Closes the account immediately — see lib/account.ts#executeAccountDeletion
// for exactly what that deletes, retains and blocks. Gated on OWNER
// specifically, not just settings:manage (which ADMIN also holds): this ends
// the whole business's access and can't be undone.
//
// The name check is repeated here, server-side, on purpose: the UI's
// disabled-until-typed button is a convenience, and a server action can be
// invoked directly.
export async function deleteAccountAction(confirmName: string): Promise<PrivacyState> {
  const authz = await getAuthz();
  const org = authz.membership?.organization;
  if (!org) return { error: "Not found." };
  if (authz.role !== "OWNER") return { error: "Only the owner can delete the account." };
  if (confirmName.trim() !== org.name) {
    return { error: "Type your venue's name exactly to confirm." };
  }

  const email = authz.user.email ?? "";
  const result = await executeAccountDeletion(org.id, email);
  if ("error" in result) return { error: result.error };

  // Written after the fact against the (retained) organisation row, so the
  // deletion itself stays traceable for the whole retention period.
  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: email,
    action: "account.deleted",
    metadata: {
      retainedUntil: result.retainedUntil.toISOString(),
      cleanupFailures: String(result.cleanupFailures.length),
    },
  });

  // Sign the session out server-side. Only THIS session — the Supabase
  // identity itself is left alone, because one user can belong to other
  // organisations. The client then hard-navigates to /account-closed.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // The account is already closed and the dashboard layout blocks it
    // regardless; a failed sign-out just leaves a cookie that goes nowhere.
  }

  return { ok: true };
}
