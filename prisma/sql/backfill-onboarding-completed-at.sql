-- ============================================================================
-- Tillz — backfill onboardingCompletedAt (personalisation wizard migration)
-- ============================================================================
-- WHY
--   onboardingCompletedAt is new and defaults to NULL. Existing restaurants
--   predate the wizard entirely, so without this backfill they'd read as
--   "never onboarded" even though they're live venues. This sets it to each
--   restaurant's createdAt, which is the closest true answer to "when did this
--   venue finish setup" for rows that came from the old, shorter wizard.
--
--   Nothing in the app currently gates on this column being non-null (the
--   wizard redirect still checks membership existence, unchanged), so this is
--   a safety/consistency backfill rather than one that unblocks a redirect —
--   but it keeps the column honest for the Settings -> Venue setup page and
--   any future reporting.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> New query -> paste all of this -> Run.
--   Safe to run more than once.
-- ============================================================================

UPDATE "Restaurant"
SET "onboardingCompletedAt" = "createdAt"
WHERE "onboardingCompletedAt" IS NULL;
