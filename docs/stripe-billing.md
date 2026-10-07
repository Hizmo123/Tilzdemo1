# Stripe Billing — local testing

Real subscription billing (`src/lib/billing/`) only activates once
`STRIPE_SECRET_KEY` is set — see `.env.example`. Until then every call falls
back to the stub (configured:false) and the existing mock-activate behaviour.

## One-time setup (test mode)

1. Create a Stripe account (or use an existing one) and switch to **test mode**.
2. Create three recurring Prices in AUD — Lite ($7.99/mo), Growth ($79/mo),
   Pro ($149/mo) — plus one for the PRO extra-venue add-on ($49.99/mo). Do
   **not** enable Stripe Tax / automatic tax on these — the prices are
   already GST-inclusive.
3. Copy each Price id into `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_LITE=price_...
   STRIPE_PRICE_GROWTH=price_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_EXTRA_VENUE=price_...
   ```

## Forwarding webhooks to localhost

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli), then from the
project root:

```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This prints a `whsec_...` value — put that in `.env` as
`STRIPE_WEBHOOK_SECRET`. Leave `stripe listen` running while you test; it
signs every forwarded event with that same secret, which is what
`src/lib/billing/stripe-provider.ts#handleWebhookEvent` verifies against.

To fire a specific event without going through a real Checkout flow:

```
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

## Trying a real checkout

With `BILLING_ENABLED=true` (or signed in as a `PLATFORM_ADMIN_USER_IDS`
account while it's off), go to `/dashboard/billing` and pick a plan — this
redirects to a real Stripe test-mode Checkout Session. Use
[Stripe's test card `4242 4242 4242 4242`](https://docs.stripe.com/testing),
any future expiry, any CVC. After paying, Stripe redirects back to
`/dashboard/billing` and the webhook (forwarded by `stripe listen`) updates
the org's plan/status within a second or two.

## What gets synced

Every handled webhook event (`checkout.session.completed`,
`customer.subscription.created/updated/deleted`, `invoice.paid`,
`invoice.payment_failed`) re-fetches the subscription fresh from Stripe and
writes that whole state — see `syncFromEvent` in `stripe-provider.ts`. This
makes processing the same event twice, or events arriving out of order,
converge to the same result either way; nothing is derived from the event
payload itself beyond "which subscription changed".
