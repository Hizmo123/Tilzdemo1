# Security checklist

## Manual steps
- [ ] GitHub → Settings → Code security: enable **Secret scanning** and **Push protection**; enable Dependabot alerts (`.github/dependabot.yml` handles weekly npm PRs)
- [ ] Rate limiting: set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel for shared counters (falls back to per-instance memory if unset)
- [ ] CSP is shipped as `Content-Security-Policy-Report-Only` (next.config.ts). Load the live site (customer visit page, Square card form, Stripe checkout, dashboard) with the browser console open; fix any violations, then rename the header to `Content-Security-Policy`
- [ ] Remaining `npm audit` highs need breaking upgrades (prisma toolchain); review via Dependabot

## Supabase RLS
1. Dashboard → SQL Editor → New query
2. Paste `SECURITY-enable-rls.sql` → Run (covers every model in `prisma/schema.prisma`)
3. For tables added later: run `prisma/sql/enable-rls-new-tables.sql`
4. Advisors → Security: confirm no "publicly accessible table" warnings

## Storage buckets
- `menu-images` — public by design (menu/logo images)
- `stand-designs` — customer-uploaded artwork; confirm in Dashboard → Storage that it is **private** (not "Public bucket") and served via signed URLs only. Delete any public-read policy on it.
- Never store receipts/exports in a public bucket (exports are streamed from route handlers, not stored)

## Rotate if ever exposed
- None found committed to git (`.env*` ignored; only `.env.example` is tracked)
