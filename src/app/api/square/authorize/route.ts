import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthz } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/square/oauth";

// Session-bound CSRF state for the OAuth round trip — verified against this
// same cookie in /api/square/callback before a code is ever exchanged.
export const SQUARE_OAUTH_STATE_COOKIE = "tillz_square_oauth_state";

export async function GET() {
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) {
    return new NextResponse("Not found", { status: 404 });
  }

  const state = randomBytes(24).toString("base64url");

  const jar = await cookies();
  jar.set(SQUARE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/square",
    maxAge: 600, // 10 minutes — long enough for the Square consent screen, no longer
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
