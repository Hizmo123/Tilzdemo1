-- ============================================================================
-- Tillz — close the gap left by tables created after SECURITY-enable-rls.sql
-- ============================================================================
-- WHY THIS EXISTS
--   prisma db push does NOT run SECURITY-enable-rls.sql. Every table created
--   after that script last ran is exposed to Supabase's public REST/GraphQL
--   API (the anon key, embedded in every page's client bundle) with full
--   SELECT/INSERT/UPDATE/DELETE — because Supabase's default privileges grant
--   the anon/authenticated roles access to new tables in `public` automatically.
--
--   Found live on this database:
--     - OnboardingDraft — in-progress venue setup, keyed by user id. Lower
--                        severity, but publicly readable/deletable all the same.
--
-- THIS IS THE SAME FIX AS SECURITY-enable-rls.sql, for the tables it missed.
-- Whenever a NEW model is added to schema.prisma, add it here too (or better:
-- re-run SECURITY-enable-rls.sql with the new table names added) — this is
-- not a one-time fix, it's a step that has to repeat every time the schema
-- grows.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste all of this → Run.
--   Safe to run more than once.
-- ============================================================================

alter table "OnboardingDraft" enable row level security;

revoke all on "OnboardingDraft" from anon, authenticated;

-- Added when the Refund model landed (Delivery 1, monetization layer):
-- financial reversal records, same exposure pattern as everything else here.
alter table "Refund" enable row level security;
revoke all on "Refund" from anon, authenticated;

-- Added when TillzStand (re)landed (stand/QR base rebuild): qrToken is a
-- printed QR's actual secret value — doubly important this is never
-- reachable via the anon/authenticated Supabase API keys, only via Prisma
-- as the table owner.
alter table "TillzStand" enable row level security;
revoke all on "TillzStand" from anon, authenticated;

-- Added with the stand order/fulfilment addendum: StandOrder carries a
-- venue's shipping address, StandOrderItem which table each stand is
-- bound for — neither belongs on the anon/authenticated API surface.
alter table "StandOrder" enable row level security;
alter table "StandOrderItem" enable row level security;
revoke all on "StandOrder" from anon, authenticated;
revoke all on "StandOrderItem" from anon, authenticated;

-- Added with the StandProduct catalog: not sensitive on its own, but same
-- blanket policy as every other table here — all access goes through Prisma
-- (admin CRUD, venue buy screen), never the anon/authenticated API surface.
alter table "StandProduct" enable row level security;
revoke all on "StandProduct" from anon, authenticated;

-- Added with the cash drawer / shift sessions build: CashDrawerSession and
-- CashMovement carry cash-handling financial records — same blanket policy,
-- all access goes through Prisma (lib/cash-drawer.ts), never the anon/
-- authenticated API surface.
alter table "CashDrawerSession" enable row level security;
alter table "CashMovement" enable row level security;
revoke all on "CashDrawerSession" from anon, authenticated;
revoke all on "CashMovement" from anon, authenticated;

-- Added with Square OAuth Phase 1: SquareConnection holds AES-256-GCM
-- encrypted access/refresh tokens per venue. Even encrypted, this must never
-- be reachable via the anon/authenticated Supabase API — all access goes
-- through Prisma (src/lib/square/oauth.ts) only.
alter table "SquareConnection" enable row level security;
revoke all on "SquareConnection" from anon, authenticated;

-- Added with Square Catalog Phase 2: the four Square<->Tillz id mapping
-- tables. Not token material, but still internal reconciliation state with
-- no reason to be reachable outside Prisma — same blanket policy.
alter table "MenuItemSquareMap" enable row level security;
alter table "MenuCategorySquareMap" enable row level security;
alter table "ModifierGroupSquareMap" enable row level security;
alter table "ModifierOptionSquareMap" enable row level security;
revoke all on "MenuItemSquareMap" from anon, authenticated;
revoke all on "MenuCategorySquareMap" from anon, authenticated;
revoke all on "ModifierGroupSquareMap" from anon, authenticated;
revoke all on "ModifierOptionSquareMap" from anon, authenticated;

-- Added with Square Webhooks Phase 4: ProcessedSquareWebhook is an internal
-- dedup record only, read/written exclusively by /api/square/webhook via
-- Prisma — same blanket policy as every other table here.
alter table "ProcessedSquareWebhook" enable row level security;
revoke all on "ProcessedSquareWebhook" from anon, authenticated;

-- Added with the onboarding overhaul: PendingSquareConnection holds a
-- venue's encrypted Square OAuth tokens between the wizard's Payments step
-- and "Create my venue" (before the Restaurant row exists). Same rule as
-- SquareConnection — only ever reached via Prisma as the table owner.
alter table "PendingSquareConnection" enable row level security;
revoke all on "PendingSquareConnection" from anon, authenticated;
