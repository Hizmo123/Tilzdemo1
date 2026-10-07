import type { PlanTier } from "@prisma/client";

// Provider-agnostic Stripe Billing abstraction — mirrors the shape of
// lib/payments/provider.ts (the per-order Square/Stripe payment interface),
// but for SUBSCRIPTIONS, a completely separate concern. The rest of the app
// (subscribe(), the Billing page) depends only on this interface, never on
// the Stripe SDK directly, so dropping in a real implementation later never
// touches a call site — only src/lib/billing/index.ts's factory changes.

export type CheckoutSessionResult =
  | { configured: true; url: string }
  | { configured: false; error: string };

export type PortalSessionResult =
  | { configured: true; url: string }
  | { configured: false; error: string };

export type WebhookHandleResult =
  | { configured: true; handled: boolean }
  | { configured: false; error: string };

export interface CreateCheckoutSessionInput {
  organizationId: string;
  tier: PlanTier;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePortalSessionInput {
  organizationId: string;
  returnUrl: string;
}

export interface HandleWebhookEventInput {
  // Raw request body — Stripe's signature check needs the exact bytes, not
  // a re-serialized JSON.parse of them.
  payload: string;
  signature: string;
}

export interface BillingProvider {
  readonly name: string;
  // Starts a hosted Checkout Session for a new or changed subscription.
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult>;
  // Starts a Stripe Billing Portal session (self-service card update, plan
  // switch, cancel) — the real replacement for the Billing page's own mock
  // plan switcher/cancel buttons, once this stops returning configured:false.
  createPortalSession(input: CreatePortalSessionInput): Promise<PortalSessionResult>;
  // Verifies + processes a Stripe webhook delivery. See
  // src/app/api/stripe/webhook/route.ts for which events this will need to
  // handle once it's real.
  handleWebhookEvent(input: HandleWebhookEventInput): Promise<WebhookHandleResult>;
}
