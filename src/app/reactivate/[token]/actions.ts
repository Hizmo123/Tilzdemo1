"use server";

import { reactivateAccount } from "@/lib/account";
import { audit } from "@/lib/audit";

export async function confirmReactivation(token: string) {
  const result = await reactivateAccount(token);
  if ("error" in result) return result;

  await audit({
    organizationId: result.organizationId,
    actorUserId: "reactivation-link",
    actorEmail: "",
    action: "account.reactivated",
  });

  return result;
}
