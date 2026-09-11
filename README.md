# Tillz

QR ordering, bill-splitting and payments for Australian restaurants. A customer
scans a table QR, orders and pays from their phone — no app download. Staff and
owners manage everything from a dashboard and a lightweight staff terminal.

> Development build. **Payments are mock only** (clearly labelled "test — no real
> money"). Real payment processing is the remaining integration.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL via Supabase, Prisma ORM
- Supabase Auth (owner/admin/manager accounts) + PIN logins for floor staff
- Supabase Storage for menu images
- Payment provider abstraction with a mock implementation (real provider drops in later)

## Setup

1. Copy `.env.example` to `.env` and fill in the five values from your Supabase
   project (URL, publishable key, secret key, and the two Prisma connection
   strings).
2. Install and sync the database:
   ```
   npm install
   npx prisma db push
   ```
3. Run it:
   ```
   npm run dev
   ```
4. Open http://localhost:3000. Sign up, create your restaurant, then use
   **Load a sample café** on the dashboard to populate a demo menu + tables.

In Supabase → Authentication → Providers → Email, turn off "Confirm email" for
local development so signup logs you straight in.

## The three surfaces

- **Customer** — `/v/[token]`, reached by scanning a table QR. No login. Menu with
  photos and modifiers, cart, running bill, split (equal / by items / custom),
  pay, call-staff. Copy a table's visit URL from the dashboard to test on desktop.
- **Owner/manager dashboard** — `/dashboard`. Restaurant, tables + QR, menu editor
  (descriptions, prices, modifiers, images, sold-out), live bills and orders,
  team (email accounts + roles), staff logins (PINs), activity log.
- **Staff terminal** — `/staff/[slug]`. Floor staff sign in with a PIN, see live
  tables, take orders, work the kitchen board, mark items sold-out, handle
  table requests.

## What's built

Auth + multi-tenant isolation · restaurants, locations, tables · opaque QR tokens
· menu with modifiers and images · customer ordering + running bill · order /
kitchen lifecycle · bill splitting + concurrency-safe partial payments · staff
email accounts with role-based access · PIN staff logins with lockout · customer
service requests · audit log · sample-data onboarding.

## What's next

Real payment processing (provider integration, webhooks as source of truth,
refunds, subscription billing) and production hardening (rate limiting,
monitoring, backups, legal/compliance review). See the payment abstraction in
`src/lib/payments/` — the mock is the only provider wired up today.

## Notes

- Money is stored as integer cents everywhere; never floats.
- The server is always the authority on prices, totals and payment amounts —
  the client is never trusted.
- After a schema change, run `npx prisma db push`.
- Next.js may warn that the `middleware` convention is deprecated in favour of
  `proxy`. It still works; migrate with `npx @next/codemod@canary middleware-to-proxy .`
  when convenient.
