-- ============================================================================
-- Tillz — one open bill per table (concurrency guard)
-- ============================================================================
-- WHY
--   The app treats a table as having at most ONE open bill at a time, but that
--   was only enforced in application code (find-or-create). Two people scanning
--   the same fresh table and hitting "send" at the same instant could each read
--   "no open bill" and each create one — two open bills, a split balance, and
--   payments that never fully close the tab. This partial unique index makes the
--   database itself refuse the second bill, so the race is impossible. The app
--   catches the resulting unique violation and retries, finding the bill the
--   other request just created.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> New query -> paste all of this -> Run.
--   Safe to run more than once.
-- ============================================================================

-- OPTIONAL PRE-STEP (only needed if the CREATE INDEX below fails complaining
-- about duplicate rows, which can happen with test data created before this
-- guard existed). It keeps the most recently created open bill on each table
-- and marks any older duplicates CANCELLED. Review before running on real data.
--
-- UPDATE "Bill" b
-- SET "status" = 'CANCELLED'
-- WHERE b."status" IN ('OPEN', 'PARTIALLY_PAID')
--   AND EXISTS (
--     SELECT 1 FROM "Bill" newer
--     WHERE newer."tableId" = b."tableId"
--       AND newer."status" IN ('OPEN', 'PARTIALLY_PAID')
--       AND newer."createdAt" > b."createdAt"
--   );

-- The guard: at most one OPEN/PARTIALLY_PAID bill per table. PAID/VOIDED/
-- CANCELLED bills are excluded, so the next customer on that table gets a
-- fresh bill as normal.
--
-- Re-running is safe. If you applied an earlier version of this index (which
-- also excluded takeaway/pickup pseudo-tables — that concept was removed),
-- drop it first so the new definition takes effect:
--   DROP INDEX IF EXISTS "one_open_bill_per_table";
DROP INDEX IF EXISTS "one_open_bill_per_table";
CREATE UNIQUE INDEX "one_open_bill_per_table"
  ON "Bill" ("tableId")
  WHERE "status" IN ('OPEN', 'PARTIALLY_PAID');
