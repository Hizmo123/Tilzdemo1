"use server";

import { revalidatePath } from "next/cache";
import type { PlanTier } from "@prisma/client";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { mockSubscriptionData } from "@/lib/plan-subscription";

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

  const data = mockSubscriptionData(tier, org.hasUsedTrial);

  await prisma.organization.update({
    where: { id: org.id },
    data,
  });

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "billing.subscribed",
    metadata: { plan: tier, startedTrial: data.trialEndsAt instanceof Date },
  });

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---- Connect-only mock addons (Connect Plus, branding removal) -------------
// Both are org-level flags on the CONNECT tier (see the Organization schema
// comment) — mock toggles only, no payment call, matching the same "mock
// now, real billing later" honesty as the extra-venue addon in
// lib/entitlements.ts#canCreateVenue. Neither ever touches appFeeBps.

export async function setConnectPlusEnabled(enabled: boolean): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage"))
    return { error: "Only an owner or admin can manage billing." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Create your restaurant first." };
  if (org.plan !== "CONNECT") return { error: "Connect Plus is only available on the Connect plan." };

  // TODO(stripe): once real billing lands, this is where enabling adds a
  // $19/mo line item to the org's (nonexistent, under CONNECT) subscription
  // instead of just flipping the flag for free under the mock model.
  await prisma.organization.update({
    where: { id: org.id },
    data: { connectPlusEnabled: enabled },
  });

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "billing.connect_plus_toggled",
    metadata: { enabled },
  });

  revalidatePath("/dashboard/billing");
  return { ok: true };
}

export async function setConnectBrandingHidden(hidden: boolean): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage"))
    return { error: "Only an owner or admin can manage billing." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Create your restaurant first." };
  if (org.plan !== "CONNECT")
    return { error: "Removing Tillz branding this way is only available on the Connect plan." };

  // TODO(stripe): once real billing lands, this is where enabling adds a
  // $9/mo line item to the org's (nonexistent, under CONNECT) subscription
  // instead of just flipping the flag for free under the mock model.
  await prisma.organization.update({
    where: { id: org.id },
    data: { connectBrandingHidden: hidden },
  });

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "billing.connect_branding_toggled",
    metadata: { hidden },
  });

  revalidatePath("/dashboard/billing");
  return { ok: true };
}

export async function cancelSubscription(): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) return { error: "Not permitted." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Not found." };

  // Lite is the free tier, not a "no subscription" state — returning to it
  // stays planStatus "active" so isOrgSubscribed/publish gating keeps
  // treating this org normally rather than as lapsed/canceled. trialEndsAt
  // clears (Lite has no trial concept to show); hasUsedTrial is
  // DELIBERATELY left untouched — that's the whole point of tracking it
  // separately, so cancelling and re-subscribing later can't grant a
  // second trial.
  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: "LITE", planStatus: "active", cardLast4: null, trialEndsAt: null },
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
