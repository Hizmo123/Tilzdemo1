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
--     - OtpChallenge   — phone numbers, OTP hashes, attempt counters. Publicly
--                        readable AND writable: an attacker could reset the
--                        attempts counter to defeat the brute-force lockout,
--                        or read every phone number that ever requested
--                        verification.
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

alter table "OtpChallenge"    enable row level security;
alter table "OnboardingDraft" enable row level security;

revoke all on "OtpChallenge"    from anon, authenticated;
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
