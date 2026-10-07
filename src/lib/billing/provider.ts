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

// Thrown by handleWebhookEvent specifically for a signature that fails
// verification — distinct from "not configured" (503) so the webhook route
// can return 400 instead, which is what tells Stripe (and anyone probing the
// endpoint) the request itself was rejected, not that the feature is off.
export class StripeSignatureError extends Error {}

export type SyncExtraVenueQuantityResult = { configured: boolean };

export interface SyncExtraVenueQuantityInput {
  organizationId: string;
  // Absolute count of venues beyond the 3 a PRO subscription includes —
  // never a delta. The caller (lib/entitlements.ts#canCreateVenue's venue-
  // creation path today; a future archive/delete-venue action later) always
  // knows the org's current total venue count, so passing the target
  // quantity directly keeps this idempotent regardless of call order.
  quantity: number;
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
  // Keeps a PRO org's "Extra venue" subscription item quantity in sync with
  // its actual venue count past the 3 included. A no-op (configured:false,
  // no error surfaced — this isn't user-facing) when there's no real
  // subscription to update, which is the correct behaviour under the mock
  // model: the venue is still created either way, for free, same as before.
  syncExtraVenueQuantity(input: SyncExtraVenueQuantityInput): Promise<SyncExtraVenueQuantityResult>;
}
