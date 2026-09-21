"use server";

import { revalidatePath } from "next/cache";
import type { PlanTier } from "@prisma/client";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export type BillingState = { error?: string; ok?: boolean };

// MOCK plan switcher — no card, no charge. Lets an owner move their org
// between tiers to exercise entitlement/gating behaviour before real
// billing exists.
// TODO(stripe): replace this with a real checkout (hosted Checkout Session
// or Payment Element) that only marks the org active once Stripe confirms
// the subscription — this direct write stays exactly where that call slots in.
export async function subscribe(tier: PlanTier): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage"))
    return { error: "Only an owner or admin can manage billing." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Create your restaurant first." };

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      plan: tier,
      planStatus: "active",
      cardLast4: null,
      subscribedAt: new Date(),
    },
  });

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "billing.subscribed",
    metadata: { plan: tier },
  });

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function cancelSubscription(): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Not found." };

  // Lite is the free tier, not a "no subscription" state — returning to it
  // stays planStatus "active" so isOrgSubscribed/publish gating keeps
  // treating this org normally rather than as lapsed/canceled.
  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: "LITE", planStatus: "active", cardLast4: null },
  });

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "billing.canceled",
  });

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}
