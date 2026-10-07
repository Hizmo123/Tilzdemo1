import type Stripe from "stripe";
import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { log } from "@/lib/log";
import { env } from "@/lib/env";
import { getStripeClient } from "./stripe-client";
import { stripePriceForTier, stripePriceForExtraVenue, tierForStripePrice } from "./prices";
import { STRIPE_WEBHOOK_ACTOR_USER_ID, STRIPE_WEBHOOK_ACTOR_EMAIL } from "./constants";
import {
  StripeSignatureError,
  type BillingProvider,
  type CreateCheckoutSessionInput,
  type CreatePortalSessionInput,
  type HandleWebhookEventInput,
  type CheckoutSessionResult,
  type PortalSessionResult,
  type WebhookHandleResult,
  type SyncExtraVenueQuantityInput,
  type SyncExtraVenueQuantityResult,
} from "./provider";

const NOT_CONFIGURED = "Billing isn't configured yet — set STRIPE_SECRET_KEY to enable real checkout.";

// The events subscribe()/the webhook route actually act on — every other
// event type Stripe might send (and there are hundreds) returns 200 fast
// with no further work, per the task's "never hold Stripe's retry queue
// hostage for an event we don't care about" requirement.
const HANDLED_EVENT_TYPES = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

// Real Stripe Billing. Selected by src/lib/billing/index.ts's factory only
// when STRIPE_SECRET_KEY is set; every method still has its own configured()
// guard so a key that's removed mid-request (or a webhook secret that never
// got set) degrades to the same "not configured" result the stub returns,
// rather than throwing.
export class StripeBillingProvider implements BillingProvider {
  readonly name = "stripe";

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = getStripeClient();
    if (!stripe) return { configured: false, error: NOT_CONFIGURED };

    const priceId = stripePriceForTier(input.tier);
    if (!priceId) {
      return {
        configured: false,
        error: `Billing isn't configured yet — no Stripe price is set for the ${input.tier} plan.`,
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { stripeCustomerId: true, hasUsedTrial: true },
    });
    if (!org) return { configured: false, error: "Organisation not found." };

    const customerId = await findOrCreateCustomer(stripe, input.organizationId, org.stripeCustomerId);

    // 14-day trial for GROWTH/PRO only, and only on an org's first-ever
    // paid-tier trial — same one-trial-ever rule the mock model already
    // enforces via Organization.hasUsedTrial (lib/plan-subscription.ts).
    // LITE never gets a trial at all, trial or not.
    const trialable = input.tier === "GROWTH" || input.tier === "PRO";
    const trialPeriodDays = trialable && !org.hasUsedTrial ? 14 : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: input.organizationId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Always capture a card, even during a trial — a trial with no card
      // on file has no way to actually start charging once it ends.
      payment_method_collection: "always",
      subscription_data: {
        metadata: { organizationId: input.organizationId },
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      },
      metadata: { organizationId: input.organizationId },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });

    if (!session.url) {
      log.error("billing.checkout_session_missing_url", { organizationId: input.organizationId, sessionId: session.id });
      return { configured: false, error: "Stripe didn't return a checkout link. Please try again." };
    }
    return { configured: true, url: session.url };
  }

  async createPortalSession(input: CreatePortalSessionInput): Promise<PortalSessionResult> {
    const stripe = getStripeClient();
    if (!stripe) return { configured: false, error: NOT_CONFIGURED };

    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { stripeCustomerId: true },
    });
    if (!org?.stripeCustomerId) {
      return { configured: false, error: "No billing account yet — subscribe to a plan first." };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: input.returnUrl,
    });
    return { configured: true, url: session.url };
  }

  async handleWebhookEvent(input: HandleWebhookEventInput): Promise<WebhookHandleResult> {
    const stripe = getStripeClient();
    const webhookSecret = env.stripeWebhookSecret();
    if (!stripe || !webhookSecret) return { configured: false, error: NOT_CONFIGURED };

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(input.payload, input.signature, webhookSecret);
    } catch (err) {
      throw new StripeSignatureError(err instanceof Error ? err.message : "Invalid Stripe webhook signature.");
    }

    log.info("billing.webhook_received", { eventId: event.id, eventType: event.type });

    if (!HANDLED_EVENT_TYPES.has(event.type)) {
      return { configured: true, handled: false };
    }

    await syncFromEvent(stripe, event);
    return { configured: true, handled: true };
  }

  async syncExtraVenueQuantity(input: SyncExtraVenueQuantityInput): Promise<SyncExtraVenueQuantityResult> {
    const stripe = getStripeClient();
    if (!stripe) return { configured: false };

    const extraVenuePriceId = stripePriceForExtraVenue();
    if (!extraVenuePriceId) return { configured: false };

    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { stripeSubscriptionId: true },
    });
    if (!org?.stripeSubscriptionId) return { configured: false };

    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    const existingItem = subscription.items.data.find((item) => item.price.id === extraVenuePriceId);
    const quantity = Math.max(0, input.quantity);

    if (quantity === 0) {
      if (existingItem) {
        await stripe.subscriptionItems.del(existingItem.id, { proration_behavior: "create_prorations" });
      }
      return { configured: true };
    }

    if (existingItem) {
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity,
        proration_behavior: "create_prorations",
      });
    } else {
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: extraVenuePriceId,
        quantity,
        proration_behavior: "create_prorations",
      });
    }
    return { configured: true };
  }
}

async function findOrCreateCustomer(
  stripe: Stripe,
  organizationId: string,
  existingCustomerId: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const owner = await prisma.membership.findFirst({
    where: { organizationId, role: "OWNER" },
    select: { email: true },
  });

  const customer = await stripe.customers.create({
    email: owner?.email,
    metadata: { organizationId },
  });

  // Persisted immediately, before the Checkout Session is even created, so a
  // retry (or the webhook landing before this request returns) reuses the
  // same customer instead of a race creating a second one.
  await prisma.organization.update({
    where: { id: organizationId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// The idempotent, order-independent core this whole webhook design rests on:
// every handled event — whatever it is — resolves to a subscription id, and
// the subscription is always re-fetched fresh from Stripe and written as a
// whole, never patched field-by-field from the event payload. Processing the
// same event twice, or two events for the same subscription in the "wrong"
// order, converges to the same final row either way.
async function syncFromEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  const subscriptionId = subscriptionIdForEvent(event);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscription(subscription, fallbackOrganizationId(event));
}

function subscriptionIdForEvent(event: Stripe.Event): string | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return null;
      return typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return subscription.id;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      // As of this API version, an invoice's subscription lives at
      // parent.subscription_details.subscription, not a top-level
      // `invoice.subscription` field (that moved under the generic
      // "parent" object so invoices can be generated by other things too).
      const invoice = event.data.object as Stripe.Invoice;
      const sub = invoice.parent?.subscription_details?.subscription;
      if (!sub) return null;
      return typeof sub === "string" ? sub : sub.id;
    }
    default:
      return null;
  }
}

// checkout.session.completed carries client_reference_id directly; every
// other handled event type gets the org id from the subscription's own
// metadata (set when the Checkout Session was created) once it's
// re-fetched — this is only a fallback for that one event, for the rare
// case the subscription's metadata hasn't propagated yet.
function fallbackOrganizationId(event: Stripe.Event): string | undefined {
  if (event.type !== "checkout.session.completed") return undefined;
  const session = event.data.object as Stripe.Checkout.Session;
  return session.client_reference_id ?? undefined;
}

async function syncSubscription(subscription: Stripe.Subscription, fallbackOrgId?: string): Promise<void> {
  const organizationId = subscription.metadata?.organizationId ?? fallbackOrgId;
  if (!organizationId) {
    log.error("billing.webhook_missing_organization_id", { subscriptionId: subscription.id });
    return;
  }

  const planItem = subscription.items.data.find((item) => tierForStripePrice(item.price.id) !== null);
  const tier = planItem ? tierForStripePrice(planItem.price.id) : null;
  const priceId = planItem?.price.id ?? null;
  const status = subscription.status;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const currentPeriodEnd = planItem?.current_period_end
    ? new Date(planItem.current_period_end * 1000)
    : null;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  let data: {
    plan?: PlanTier;
    planStatus?: string;
    subscriptionLapsedAt?: Date | null;
    hasUsedTrial?: boolean;
  } & Record<string, unknown>;

  if (status === "trialing" || status === "active") {
    if (!tier) {
      // A subscription whose price doesn't match any configured tier env
      // var — e.g. STRIPE_PRICE_GROWTH was reconfigured after this
      // subscription was created. Nothing safe to do but log and leave the
      // org's plan untouched; the Stripe-side price/status fields still get
      // recorded below so this is visible on the org row.
      log.error("billing.webhook_unknown_price", { subscriptionId: subscription.id, priceId });
      data = {};
    } else {
      data = {
        plan: tier,
        planStatus: "active",
        subscriptionLapsedAt: null,
        ...(status === "trialing" ? { hasUsedTrial: true } : {}),
      };
    }
  } else if (status === "past_due") {
    // Keep access — Stripe is still retrying the charge. stripeStatus below
    // is what the Billing page's payment-failed banner reads; plan/
    // planStatus are deliberately untouched.
    data = {};
  } else {
    // canceled | unpaid | incomplete_expired | paused: no working
    // subscription. Connect (Pay as you sell) is the only tier with no
    // subscription at all, so that's where a lapsed/cancelled org lands —
    // never a hard lockout, and nothing about their existing tables, menu
    // or venues is touched.
    data = {
      plan: "CONNECT",
      planStatus: "active",
      subscriptionLapsedAt: null,
    };
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...data,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeStatus: status,
      stripePriceId: priceId,
      currentPeriodEnd,
      trialEnd,
      cancelAtPeriodEnd,
    },
  });

  await audit({
    organizationId,
    actorUserId: STRIPE_WEBHOOK_ACTOR_USER_ID,
    actorEmail: STRIPE_WEBHOOK_ACTOR_EMAIL,
    action: "billing.stripe_synced",
    metadata: { subscriptionId: subscription.id, status, tier, priceId },
  });
}
