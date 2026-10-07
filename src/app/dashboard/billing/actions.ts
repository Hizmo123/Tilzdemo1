"use server";

import { revalidatePath } from "next/cache";
import type { PlanTier } from "@prisma/client";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { mockSubscriptionData } from "@/lib/plan-subscription";
import { BRAND } from "@/lib/brand";
import { PLANS } from "@/lib/plans";
import {
  getBillingProvider,
  paidPlansOpen,
  PAID_PLANS_CLOSED_MESSAGE,
  SELF_ASSIGNABLE_GATED_TIERS,
} from "@/lib/billing";

// Hidden (grandfathered) tiers an org can only ever ALREADY be on, never
// newly switch to — Basic outright, Connect everywhere except its own
// Square-first flow (dashboard/billing/checkout.tsx's "Connect Square to
// switch" button, which only renders once squareConnected is true and only
// then calls subscribe("CONNECT")). This is the server-side half of "removed
// from every picker": the UI not offering a hidden tier is cosmetic on its
// own — this is what actually stops a POST crafted outside the UI.
const PUBLIC_TIERS = new Set(PLANS.map((p) => p.tier));

export type BillingState = { error?: string; ok?: boolean };

// MOCK plan switcher — no card, no charge. Lets an owner move their org
// between tiers to exercise entitlement/gating behaviour before real
// billing exists. Blocked outright for LITE/GROWTH/PRO (platform admins
// excepted) until paidPlansOpen() — see src/lib/billing/gate.ts — since
// without that gate this function is how anyone could grant themselves a
// subscription for free.
export async function subscribe(tier: PlanTier): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage"))
    return { error: "Only an owner or admin can manage billing." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Create your restaurant first." };

  if (SELF_ASSIGNABLE_GATED_TIERS.has(tier) && !paidPlansOpen(authz.user.id)) {
    return { error: PAID_PLANS_CLOSED_MESSAGE };
  }

  if (!PUBLIC_TIERS.has(tier) && tier !== org.plan) {
    // Connect's one exception: reachable through its own Square-first flow
    // (checkout.tsx only ever calls subscribe("CONNECT") once squareConnected
    // is true — see needsSquareFirst there), never as a bare picker choice.
    const restaurant = org.restaurants[0];
    const squareConnection =
      tier === "CONNECT" && restaurant
        ? await prisma.squareConnection.findUnique({
            where: { restaurantId: restaurant.id },
            select: { revokedAt: true },
          })
        : null;
    const squareConnected = !!squareConnection && !squareConnection.revokedAt;
    if (!squareConnected) return { error: "That plan isn't available." };
  }

  // Routes through the billing provider interface first — once a real
  // StripeBillingProvider replaces the stub, this is where a configured
  // response starts sending the caller to a real Checkout Session instead of
  // falling through to the instant mock write below. The stub always comes
  // back not-configured today, so behaviour is unchanged until Stripe lands.
  const provider = getBillingProvider();
  const checkout = await provider.createCheckoutSession({
    organizationId: org.id,
    tier,
    successUrl: "/dashboard/billing",
    cancelUrl: "/dashboard/billing",
  });
  if (checkout.configured) {
    return { ok: true };
  }

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
    return { error: `Removing ${BRAND.name} branding this way is only available on the Connect plan.` };

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

  // Lite is a paid tier too now, not a "no subscription" state — so
  // "cancel" here means "downgrade to Lite", which is just as much a new
  // paid-tier self-assignment as subscribe() and needs the same gate.
  if (!paidPlansOpen(authz.user.id)) {
    return { error: PAID_PLANS_CLOSED_MESSAGE };
  }

  // Returning to Lite stays planStatus "active" so isOrgSubscribed/publish
  // gating keeps treating this org normally rather than as lapsed/canceled.
  // trialEndsAt clears (Lite has no trial concept to show); hasUsedTrial is
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
