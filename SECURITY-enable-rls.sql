-- ============================================================================
-- Tillz — enable Row-Level Security on all application tables
-- ============================================================================
-- WHAT THIS DOES
--   Turns on Row-Level Security (RLS) for every table and adds NO public
--   policies. With RLS on and no policy, Supabase's public API (the anon /
--   publishable key path) can no longer read or write these tables. This closes
--   the "Table publicly accessible" warning.
--
-- WHY IT'S SAFE FOR THIS APP
--   Tillz never touches these tables through Supabase's public API. It queries
--   them through Prisma over a direct Postgres connection as the table owner,
--   and the table owner bypasses RLS by default (we do NOT use FORCE). So the
--   app keeps working exactly as before — only the public back door is closed.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste all of this → Run.
--   Safe to run more than once.
-- ============================================================================

alter table "Organization"      enable row level security;
alter table "Restaurant"        enable row level security;
alter table "Location"          enable row level security;
alter table "Table"             enable row level security;
alter table "QrToken"           enable row level security;
alter table "MenuCategory"      enable row level security;
alter table "MenuItem"          enable row level security;
alter table "ModifierGroup"     enable row level security;
alter table "ModifierOption"    enable row level security;
alter table "Bill"              enable row level security;
alter table "BillItem"          enable row level security;
alter table "Order"             enable row level security;
alter table "Payment"           enable row level security;
alter table "StaffInvite"       enable row level security;
alter table "AuditLog"          enable row level security;
alter table "StaffAccount"      enable row level security;
alter table "CustomerRequest"   enable row level security;
alter table "Membership"        enable row level security;

-- Optional belt-and-braces: revoke the public API roles' access outright, so
-- the tables are locked to the server (Prisma) connection only.
revoke all on all tables in schema public from anon, authenticated;
