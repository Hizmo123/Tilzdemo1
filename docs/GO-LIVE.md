# Go-live checklist

## Vercel env vars (Production)
- [ ] `NEXT_PUBLIC_APP_URL=https://taptoit.com.au` (also drives Square OAuth redirect + webhook URL)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- [ ] `DATABASE_URL` (pooled, 6543), `DIRECT_URL` (5432)
- [ ] `PLATFORM_ADMIN_USER_IDS`
- [ ] `RESEND_API_KEY`, `RESEND_FROM` (sender verified in Resend)
- [ ] `PAID_PLANS_OPEN` — leave unset (closed) until Stripe live; `true` opens Lite/Growth/Pro

## Square (production)
- [ ] `SQUARE_ENV=production`
- [ ] `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET` — the **production** values (same var names; sandbox values must not be set in Production)
- [ ] `SQUARE_TOKEN_ENC_KEY` (base64 32 bytes), `SQUARE_APP_FEE_BPS`
- [ ] `SQUARE_WEBHOOK_SIGNATURE_KEY` — from the production webhook subscription
- [ ] `SQUARE_REDIRECT_URL` — optional; defaults to `https://taptoit.com.au/api/square/callback`
- [ ] Leave `ALLOW_MOCK_PAYMENTS` unset (mock payments are blocked when `SQUARE_ENV=production`)

Square Developer Dashboard → your app → switch to **Production**:
1. OAuth → Redirect URL = `https://taptoit.com.au/api/square/callback`
2. Webhooks → Add subscription → URL = `https://taptoit.com.au/api/square/webhook` (must match exactly; it is the signature notification URL)
3. Subscribe to the payment/order events the app handles; copy the Signature Key into `SQUARE_WEBHOOK_SIGNATURE_KEY`
4. Copy the production Application ID + Secret into Vercel

## Stripe (live mode, when opening paid plans)
- [ ] `STRIPE_SECRET_KEY` (live `sk_live_…`)
- [ ] `STRIPE_WEBHOOK_SECRET` (from the live endpoint)
- [ ] `STRIPE_PRICE_LITE`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_EXTRA_VENUE`
- [ ] Stripe webhook endpoint: `https://taptoit.com.au/api/stripe/webhook`; events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`
- [ ] Then set `PAID_PLANS_OPEN=true` and redeploy

## Supabase RLS
1. Supabase dashboard → SQL Editor → New query
2. Paste the contents of `SECURITY-enable-rls.sql` (repo root) → Run
3. For tables added later, run `prisma/sql/enable-rls-new-tables.sql`
4. Re-check Advisors → Security: no "publicly accessible" warnings

## Later
- [ ] Next.js `middleware.ts` → `proxy.ts` migration (not a trivial rename; skipped)
- [ ] Rename `package.json` name `tillz` → `tap-to-it`
