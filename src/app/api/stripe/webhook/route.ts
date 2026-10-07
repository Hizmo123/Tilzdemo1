import { NextResponse } from "next/server";
import { getBillingProvider, StripeSignatureError } from "@/lib/billing";
import { log } from "@/lib/log";

// Stripe Billing webhook endpoint. Returns 503 ("not configured") until
// STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are both set, 400 for a
// signature that fails verification, 200 for anything handled OR any event
// type this app doesn't act on (Stripe sends hundreds of event types; an
// unhandled one is not an error). Never parses the body as JSON before
// verifying it — Stripe's signature check needs the exact raw bytes.
//
// Events this handles (see src/lib/billing/stripe-provider.ts#syncFromEvent):
//   - checkout.session.completed      — a Checkout Session finished;
//     resolves to its subscription and syncs from that.
//   - customer.subscription.created/updated/deleted — the subscription
//     itself changed (plan, trial -> active, cancellation, ...).
//   - invoice.paid / invoice.payment_failed — a renewal invoice settled or
//     failed; payment_failed is what the Billing page's payment-failed
//     banner (stripeStatus === "past_due") ultimately reflects.
// Every one of these re-fetches the subscription fresh from Stripe and
// writes that whole state, rather than trusting the event payload or the
// order events arrive in — see syncFromEvent's own comment for why.
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  try {
    const result = await getBillingProvider().handleWebhookEvent({ payload, signature });
    if (!result.configured) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({ handled: result.handled });
  } catch (err) {
    if (err instanceof StripeSignatureError) {
      log.error("billing.webhook_bad_signature", { message: err.message });
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }
    log.error("billing.webhook_failed", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
