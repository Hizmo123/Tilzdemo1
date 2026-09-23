import {
  scryptSync,
  randomBytes,
  createHmac,
  timingSafeEqual,
  randomInt,
} from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEntitlements } from "@/lib/entitlements";

// Staff PIN authentication. This is a SECOND, lighter identity type that lives
// alongside Supabase email/password accounts (used by owners/admins/managers).
// Floor staff log in with a short numeric PIN scoped to one restaurant.
//
// Security posture:
//  - PINs are hashed with scrypt + per-PIN salt; the raw PIN is shown to the
//    owner once at creation/reset and never stored.
//  - Login is per-restaurant (the venue is in the URL) and pick-name-then-PIN,
//    so a PIN only needs to be guessed within one venue.
//  - Failed attempts lock the account for a cool-down, making online
//    brute-force infeasible even for a 5-digit PIN.
//  - The session is a short-lived HMAC-signed cookie; tampering or expiry is
//    rejected server-side.

export const PIN_LENGTH = 5;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_TTL_HOURS = 12;
const COOKIE_NAME = "tillz_staff";

// Prefers a dedicated secret so a leak of the staff-session signing path
// can't also be used to derive/replay against SUPABASE_SECRET_KEY, which has
// full admin access to the whole database and storage. Falls back to the
// Supabase key so existing deployments keep working without a config change —
// but set STAFF_SESSION_SECRET (any long random string) in production.
function signingKey(): string {
  const key = process.env.STAFF_SESSION_SECRET ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error("STAFF_SESSION_SECRET (or SUPABASE_SECRET_KEY) is required for staff sessions");
  }
  return key;
}

// ---- PIN generation & hashing ----------------------------------------------

export function generatePin(length = PIN_LENGTH): string {
  let pin = "";
  for (let i = 0; i < length; i++) pin += randomInt(0, 10).toString();
  return pin;
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const test = scryptSync(pin, salt, 32);
  const known = Buffer.from(hash, "hex");
  return test.length === known.length && timingSafeEqual(test, known);
}

// ---- Session cookie ---------------------------------------------------------

type StaffSessionPayload = {
  staffId: string;
  restaurantId: string;
  exp: number;
};

function sign(payload: StaffSessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingKey())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string | undefined): StaffSessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", signingKey())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as StaffSessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setStaffSession(staffId: string, restaurantId: string) {
  const exp = Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000;
  const token = sign({ staffId, restaurantId, exp });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 60 * 60,
  });
}

export async function clearStaffSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// Resolves the current staff session to a live, active StaffAccount, or null.
// Re-checks the DB every time (still per-request only — never cached across
// requests) so a deactivated staff member loses access immediately, even with
// a still-valid cookie. Cached per request so a page and any component it
// renders can both ask for the session without paying for a second lookup.
export const getStaffSession = cache(async () => {
  const jar = await cookies();
  const payload = verify(jar.get(COOKIE_NAME)?.value);
  if (!payload) return null;

  const staff = await prisma.staffAccount.findFirst({
    where: { id: payload.staffId, active: true },
    include: { restaurant: { include: { organization: { select: { deactivatedAt: true } } } } },
  });
  if (!staff || staff.restaurantId !== payload.restaurantId) return null;
  // A session issued before deactivation stays a valid cookie — this is what
  // actually cuts it off mid-shift, not just the login step. See
  // lib/account.ts#deactivateAccount.
  if (staff.restaurant.organization.deactivatedAt) return null;
  return { staff, restaurant: staff.restaurant };
});

// ---- Login with lockout -----------------------------------------------------

export type StaffLoginResult =
  | { ok: true; role: string; assignedStation: string | null }
  | { ok: false; error: string };

// Verifies a PIN for a named staff account, applying attempt lockout. On success
// a session cookie is set and the failure counter reset.
export async function staffLogin(
  staffId: string,
  restaurantId: string,
  pin: string,
): Promise<StaffLoginResult> {
  const staff = await prisma.staffAccount.findFirst({
    where: { id: staffId, restaurantId, active: true },
  });
  // Uniform error — never reveal whether the name or the PIN was the problem.
  const generic = { ok: false as const, error: "Incorrect PIN." };
  if (!staff) return generic;

  if (staff.lockedUntil && staff.lockedUntil > new Date()) {
    return {
      ok: false,
      error: "Too many attempts. Try again in a few minutes.",
    };
  }

  if (!verifyPin(pin, staff.pinHash)) {
    const failed = staff.failedAttempts + 1;
    await prisma.staffAccount.update({
      where: { id: staff.id },
      data: {
        failedAttempts: failed,
        lockedUntil:
          failed >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
      },
    });
    return generic;
  }

  await prisma.staffAccount.update({
    where: { id: staff.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await setStaffSession(staff.id, restaurantId);
  return { ok: true, role: staff.role, assignedStation: staff.assignedStation };
}

// Resolves the current staff session and confirms it belongs to the given venue
// slug. Returns the staff + restaurant, or null. Use at the top of every staff
// server action so a session for one venue can't act on another.
export async function requireStaffForSlug(slug: string) {
  const session = await getStaffSession();
  if (!session || session.restaurant.slug !== slug) return null;
  return session;
}

// HARD guard for the staff terminal's owner-operated pages (home, kitchen,
// menu editor, table service, counter, register) on a LITE org — menu-only,
// no live service to run a staff terminal against. Deliberately NOT reused
// from lib/auth.ts#requireOrdering: that helper resolves the ORG via the
// owner's Supabase session (requireUser/getTenantContext), which staff never
// have — they authenticate with a PIN via this file's own session, not a
// dashboard login. Calling the owner-side helper here would incorrectly
// bounce every staff member, on every venue, to /login. This resolves
// entitlements via the STAFF session's own restaurant instead, and — since
// there is no staff-side "/dashboard" to fall back to — redirects to this
// venue's own staff landing/login page. Never call this from the PIN login
// page itself (src/app/staff/[slug]/page.tsx) or from anything under
// /v/[token] (the customer flow this build never touches).
export async function requireStaffOrdering(
  organizationId: string,
  slug: string,
) {
  const ent = await getEntitlements(organizationId);
  if (!ent.ordering) redirect(`/staff/${slug}`);
}

// Same shape as requireStaffOrdering, for the counter/register pages
// specifically: on Connect, no cash-drawer/counter workflow applies —
// Square handles the venue's own in-person payments if they use one — so a
// Connect staff member typing these URLs directly must be bounced back to
// the floor, not just miss the header link (see staff/[slug]/home/page.tsx's
// nav filtering, which is cosmetic only).
export async function requireStaffCounterAllowed(
  organizationId: string,
  slug: string,
) {
  const ent = await getEntitlements(organizationId);
  if (ent.requiresSquare) redirect(`/staff/${slug}/home`);
}
