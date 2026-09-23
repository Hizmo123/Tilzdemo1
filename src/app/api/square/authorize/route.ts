import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthz, getUser } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/square/oauth";

// Session-bound CSRF state for the OAuth round trip — verified against this
// same cookie in /api/square/callback before a code is ever exchanged.
export const SQUARE_OAUTH_STATE_COOKIE = "tillz_square_oauth_state";

// Which flow started the round trip, so the callback knows where to put the
// result and where to send the user back:
//   "settings"                — the normal Settings → Integrations connect;
//                               writes SquareConnection for restaurants[0].
//   "onboarding:<returnPath>" — started from the setup wizard, BEFORE the
//                               restaurant exists; writes
//                               PendingSquareConnection for the user and
//                               returns to the wizard at <returnPath>.
export const SQUARE_OAUTH_FLOW_COOKIE = "tillz_square_oauth_flow";

// The only places an onboarding-flow round trip may return to.
export const ONBOARDING_RETURN_PATHS = ["/onboarding", "/venues/new"] as const;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const onboarding = sp.get("flow") === "onboarding";

  let flow: string;
  if (onboarding) {
    // The wizard has no membership/restaurant yet — a signed-in user is the
    // whole requirement. (For the "+ Add venue" flow the user does have a
    // membership, but the NEW restaurant still doesn't exist, so it goes
    // through the same pending path.)
    const user = await getUser();
    if (!user) return new NextResponse("Not found", { status: 404 });
    const back = sp.get("return") ?? "/onboarding";
    if (!(ONBOARDING_RETURN_PATHS as readonly string[]).includes(back)) {
      return new NextResponse("Not found", { status: 404 });
    }
    flow = `onboarding:${back}`;
  } else {
    const authz = await getAuthz();
    if (!authz.can("settings:manage")) {
      return new NextResponse("Not found", { status: 404 });
    }
    const restaurant = authz.membership?.organization.restaurants[0];
    if (!restaurant) {
      return new NextResponse("Not found", { status: 404 });
    }
    flow = "settings";
  }

  const state = randomBytes(24).toString("base64url");

  const jar = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/square",
    maxAge: 600, // 10 minutes — long enough for the Square consent screen, no longer
  };
  jar.set(SQUARE_OAUTH_STATE_COOKIE, state, cookieOpts);
  jar.set(SQUARE_OAUTH_FLOW_COOKIE, flow, cookieOpts);

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
