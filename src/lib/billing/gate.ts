import type { PlanTier } from "@prisma/client";
import { env } from "@/lib/env";
import { isPlatformAdminId } from "@/lib/platform-admin";
import { BRAND } from "@/lib/brand";

// The three self-assignable subscription tiers — every tier a signup or an
// existing org could put itself on for free under the mock billing model.
// CONNECT is deliberately excluded: it has no subscription to self-assign,
// just a per-order fee once Square is connected, so it needs no gate here.
// BASIC is excluded too: grandfathered, never newly assignable regardless of
// this gate (see dashboard/billing/actions.ts's separate PUBLIC_TIERS check).
export const SELF_ASSIGNABLE_GATED_TIERS = new Set<PlanTier>(["LITE", "GROWTH", "PRO"]);

// Whether a self-service action may put an org onto a real subscription tier
// (LITE/GROWTH/PRO — the three tiers that cost money and, until Stripe is
// wired up, are only "activated" by the mock write in
// lib/plan-subscription.ts#mockSubscriptionData). CONNECT needs no gate: it
// has no subscription to self-assign, just a per-order fee once Square is
// connected.
//
// Driven solely by PAID_PLANS_OPEN=true; closed when unset. No per-user
// bypass. userId is accepted (and ignored) so existing callers keep working.
export function paidPlansOpen(_userId?: string | null): boolean {
  return env.paidPlansOpen();
}

// Shown to the user when a gated action is rejected, and (trimmed of the
// email) near the disabled plan buttons in the UI while the gate is closed.
export const PAID_PLANS_CLOSED_MESSAGE = `Paid plans aren't open yet — email ${BRAND.supportEmail} for early access.`;
