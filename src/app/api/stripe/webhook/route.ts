import { NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/billing";

// Stripe Billing webhook endpoint — not live yet. Returns 503 until
// STRIPE_SECRET_KEY (and, for real signature verification,
// STRIPE_WEBHOOK_SECRET) are configured, via the same provider.handleWebhookEvent
// "not configured" result every other billing call site reads. No Stripe SDK
// import here, no signature verification yet, no network calls — this route
// only exists so Stripe's dashboard has a stable URL to point at ahead of
// time.
//
// Events this will need to handle once real billing lands:
//   - checkout.session.completed      — a Checkout Session finished; mark the
//     org's stripeCustomerId/stripeSubscriptionId and activate its plan.
//   - customer.subscription.updated   — plan/price/period changed (including
//     trial -> active) or payment failed (status -> "past_due"/"unpaid");
//     mirror stripeStatus/stripePriceId/currentPeriodEnd/cancelAtPeriodEnd.
//   - customer.subscription.deleted   — subscription ended (cancelled or
//     unrecoverable failure); drop the org back to a no-subscription state.
//   - invoice.payment_failed          — a renewal charge failed; this is what
//     should start the existing subscriptionLapsedAt grace-period flow
//     (see lib/entitlements.ts), not customer.subscription.updated alone.
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  const result = await getBillingProvider().handleWebhookEvent({ payload, signature });
  if (!result.configured) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({ handled: result.handled });
}
