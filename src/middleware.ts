import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Every QR code on a table is a public URL — nobody has to sign in to hit
// /v/[token], so nothing stops a script from hammering it. Rate limits here
// are best-effort (see lib/rate-limit.ts for the real caveat) but still
// worth having: the common case is one source flooding one route, and this
// stops that cheaply, before it reaches a database query.
const RATE_LIMITS: { prefix: string; limit: number; windowMs: number }[] = [
  // Customer ordering/paying surface — generous, since a real table full of
  // people ordering, paying and refreshing can generate real traffic.
  { prefix: "/v/", limit: 300, windowMs: 5 * 60 * 1000 },
  // Stand QR resolve (/s/<qrToken> -> /v/<token>): a redirect-only endpoint
  // hit once per scan, not an interactive page needing repeated requests, so
  // a much lower ceiling than /v/ still comfortably covers real use while
  // making enumeration of the 16-char qrToken space meaningfully slower.
  { prefix: "/s/", limit: 60, windowMs: 5 * 60 * 1000 },
  // Auth pages — Supabase already rate-limits the underlying sign-in/sign-up
  // calls itself; this is a second, coarser layer against a script just
  // hammering the page.
  { prefix: "/login", limit: 30, windowMs: 10 * 60 * 1000 },
  { prefix: "/signup", limit: 30, windowMs: 10 * 60 * 1000 },
  { prefix: "/forgot-password", limit: 30, windowMs: 10 * 60 * 1000 },
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // An uptime monitor hits this every 30-60s — skip the Supabase session
  // round-trip and rate limiting entirely so the check stays fast and never
  // false-positives as "down" because of an unrelated limit.
  if (path === "/api/health") return NextResponse.next();

  const rule = RATE_LIMITS.find((r) => path.startsWith(r.prefix));
  if (rule) {
    const ip = clientIp(request.headers);
    const { allowed, retryAfterSeconds } = checkRateLimit(
      `${rule.prefix}:${ip}`,
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
