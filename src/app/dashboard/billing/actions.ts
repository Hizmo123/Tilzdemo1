"use server";

import { revalidatePath } from "next/cache";
import type { PlanTier } from "@prisma/client";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { BRAND } from "@/lib/brand";
import { PLANS } from "@/lib/plans";
import { appBaseUrl } from "@/lib/urls";
import {
  getBillingProvider,
  paidPlansOpen,
  PAID_PLANS_CLOSED_MESSAGE,
  SELF_ASSIGNABLE_GATED_TIERS,
} from "@/lib/billing";
import { startSubscriptionOrMock } from "@/lib/billing/checkout-or-mock";

// Hidden (grandfathered) tiers an org can only ever ALREADY be on, never
// newly switch to — Basic outright, Connect everywhere except its own
// Square-first flow (dashboard/billing/checkout.tsx's "Connect Square to
// switch" button, which only renders once squareConnected is true and only
// then calls subscribe("CONNECT")). This is the server-side half of "removed
// from every picker": the UI not offering a hidden tier is cosmetic on its
// own — this is what actually stops a POST crafted outside the UI.
const PUBLIC_TIERS = new Set(PLANS.map((p) => p.tier));

export type BillingState = { error?: string; ok?: boolean; redirectUrl?: string };

// Starts a real Stripe subscription when Stripe is configured (redirects to
// a Checkout Session), or falls back to the mock instant-activate write
// when it isn't — see startSubscriptionOrMock. Blocked outright for
// LITE/GROWTH/PRO (platform admins excepted) until paidPlansOpen() — see
// src/lib/billing/gate.ts — since without that gate this is how anyone
// could grant themselves a subscription for free under the mock model, or
// (once Stripe is live) jump straight to a real Checkout Session before
// paid plans are meant to be open at all.
//
// An org with an existing real Stripe subscription (stripeSubscriptionId
// set) should go through manageBilling()'s portal instead — see
// checkout.tsx, which only ever calls this for a tier the org doesn't
// already have a live subscription for.
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

  const billingUrl = `${appBaseUrl()}/dashboard/billing`;
  const result = await startSubscriptionOrMock({
    organizationId: org.id,
    tier,
    hasUsedTrial: org.hasUsedTrial,
    successUrl: billingUrl,
    cancelUrl: billingUrl,
  });

  if ("redirectUrl" in result) {
    return { ok: true, redirectUrl: result.redirectUrl };
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: result.mockData,
  });

  await audit({
    organizationId: org.id,
    actorUserId: authz.user.id,
    actorEmail: authz.user.email ?? "",
    action: "billing.subscribed",
    metadata: { plan: tier, startedTrial: result.mockData.trialEndsAt instanceof Date },
  });

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Sends an org with a real Stripe subscription to the Billing Portal —
// Stripe's own hosted UI for updating a card, switching plans or cancelling
// (at period end, per the portal's own configuration), so this app never
// has to build custom proration logic. Falls back to a clear error — not a
// silent no-op — when the org has no Stripe customer yet (e.g. it's still
// on a mock-activated or manually-assigned plan and has never actually
// checked out).
export async function manageBilling(): Promise<BillingState> {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) return { error: "Only an owner or admin can manage billing." };
  const org = authz.membership?.organization;
  if (!org) return { error: "Create your restaurant first." };

  const portal = await getBillingProvider().createPortalSession({
    organizationId: org.id,
    returnUrl: `${appBaseUrl()}/dashboard/billing`,
  });
  if (!portal.configured) return { error: portal.error };

  return { ok: true, redirectUrl: portal.url };
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

  // A REAL Stripe subscription must be cancelled through Stripe (the
  // Billing Portal, via manageBilling()) so the actual charge stops —
  // writing plan: "LITE" straight to our own DB here would leave Stripe
  // still billing the org every month while our side thinks it's free.
  // checkout.tsx only renders this button at all when there's no
  // stripeSubscriptionId, but the real gate has to live here too.
  if (org.stripeSubscriptionId) {
    return { error: "Manage your subscription from the billing portal instead." };
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
