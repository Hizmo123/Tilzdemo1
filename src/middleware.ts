import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Every QR code on a table is a public URL — nobody has to sign in to hit
// /v/[token], so nothing stops a script from hammering it. Rate limits here
// are best-effort (see lib/rate-limit.ts for the real caveat) but still
// worth having: the common case is one source flooding one route, and this
// stops that cheaply, before it reaches a database query.
type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
  // Defaults to a prefix match on `key`. Only the staff-login rule below
  // needs the precise regex instead — everything past /staff/<slug> (the
  // operational area: kitchen board, home floor, table service) polls
  // legitimately every few seconds via LiveRefresh and must NOT share a
  // budget with the login page, or normal shift traffic would trip it.
  match?: (path: string) => boolean;
};

const RATE_LIMITS: RateLimitRule[] = [
  // Customer ordering/paying surface — generous, since a real table full of
  // people ordering, paying and refreshing can generate real traffic.
  { key: "/v/", limit: 300, windowMs: 5 * 60 * 1000 },
  // Stand QR resolve (/s/<qrToken> -> /v/<token>): a redirect-only endpoint
  // hit once per scan, not an interactive page needing repeated requests, so
  // a much lower ceiling than /v/ still comfortably covers real use while
  // making enumeration of the 16-char qrToken space meaningfully slower.
  { key: "/s/", limit: 60, windowMs: 5 * 60 * 1000 },
  // Auth pages — Supabase already rate-limits the underlying sign-in/sign-up
  // calls itself; this is a second, coarser layer against a script just
  // hammering the page.
  { key: "/login", limit: 30, windowMs: 10 * 60 * 1000 },
  { key: "/signup", limit: 30, windowMs: 10 * 60 * 1000 },
  { key: "/forgot-password", limit: 30, windowMs: 10 * 60 * 1000 },
  // Staff PIN terminal login page ONLY (/staff/<slug>, exactly — never
  // /staff/<slug>/home, /kitchen, etc., which poll every few seconds via
  // LiveRefresh and would blow this budget on ordinary shift traffic). The
  // page load renders every active staff member's name (by design — it's a
  // shared-tablet "tap your name" pad, the same pattern most POS PIN
  // terminals use) with no auth, and PIN submission is a Server Action
  // POSTed to this SAME url, so one limit here covers both halves of the
  // same risk: scraping the roster, and brute-forcing PINs. Per-account
  // lockout already exists (5 bad attempts locks that ONE account for 15
  // minutes — lib/staff-auth.ts), but nothing previously capped how many
  // DIFFERENT accounts one source could attack in a burst — this closes
  // that: at ~60 requests/5min from one source, exhausting even a modest
  // roster (5 attempts x N staff) takes several rounds, not one.
  {
    key: "/staff/:login",
    limit: 60,
    windowMs: 5 * 60 * 1000,
    match: (path) => /^\/staff\/[^/]+\/?$/.test(path),
  },
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // An uptime monitor hits this every 30-60s — skip the Supabase session
  // round-trip and rate limiting entirely so the check stays fast and never
  // false-positives as "down" because of an unrelated limit.
  if (path === "/api/health") return NextResponse.next();

  const rule = RATE_LIMITS.find((r) => (r.match ? r.match(path) : path.startsWith(r.key)));
  if (rule) {
    const ip = clientIp(request.headers);
    const { allowed, retryAfterSeconds } = checkRateLimit(
      `${rule.key}:${ip}`,
      rule.limit,
      rule.windowMs,
    );
    if (!allowed) {
      return new NextResponse("Too many requests. Please slow down.", {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      });
    }
  }

  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and image files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
