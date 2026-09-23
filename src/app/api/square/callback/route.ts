import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthz, getUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { exchangeCode, squareEnvironment } from "@/lib/square/oauth";
import { encryptToken } from "@/lib/square/crypto";
import { squareBaseUrl, SQUARE_OAUTH_SCOPES } from "@/lib/square/config";
import {
  SQUARE_OAUTH_STATE_COOKIE,
  SQUARE_OAUTH_FLOW_COOKIE,
  ONBOARDING_RETURN_PATHS,
} from "@/app/api/square/authorize/route";

const SETTINGS_REDIRECT = "/dashboard/settings/integrations";

function fail(request: NextRequest, redirectTo: string, reason: string) {
  const url = new URL(redirectTo, request.url);
  url.searchParams.set("square", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

// Merchant display name only — never logs or forwards the access token used
// to fetch it. Best-effort: a failure here still lets the connection save,
// just without a friendly name yet.
async function fetchMerchantName(accessToken: string, environment: "sandbox" | "production", merchantId: string): Promise<string | null> {
  try {
    const res = await fetch(`${squareBaseUrl(environment)}/v2/merchants/${merchantId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": "2024-10-17",
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.merchant?.business_name ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Resolve the flow FIRST — it decides both the auth requirement and where
  // any error should send the user. Read-and-clear, same as the state cookie.
  const jar = await cookies();
  const flow = jar.get(SQUARE_OAUTH_FLOW_COOKIE)?.value ?? "settings";
  jar.delete(SQUARE_OAUTH_FLOW_COOKIE);

  let onboardingReturn: string | null = null;
  if (flow.startsWith("onboarding:")) {
    const back = flow.slice("onboarding:".length);
    onboardingReturn = (ONBOARDING_RETURN_PATHS as readonly string[]).includes(back) ? back : "/onboarding";
  }
  const redirectTo = onboardingReturn ?? SETTINGS_REDIRECT;

  // Auth: the settings flow needs a manager with a restaurant; the onboarding
  // flow only needs the signed-in user (the restaurant doesn't exist yet).
  const user = await getUser();
  if (!user) return new NextResponse("Not found", { status: 404 });

  let restaurant: { id: string; organizationId: string } | null = null;
  if (!onboardingReturn) {
    const authz = await getAuthz();
    if (!authz.can("settings:manage")) {
      return new NextResponse("Not found", { status: 404 });
    }
    restaurant = authz.membership?.organization.restaurants[0] ?? null;
    if (!restaurant) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const sp = request.nextUrl.searchParams;
  const error = sp.get("error");
  if (error) return fail(request, redirectTo, error);

  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return fail(request, redirectTo, "missing_params");

  const expectedState = jar.get(SQUARE_OAUTH_STATE_COOKIE)?.value;
  jar.delete(SQUARE_OAUTH_STATE_COOKIE);
  if (!expectedState || expectedState !== state) {
    return fail(request, redirectTo, "state_mismatch");
  }

  try {
    const result = await exchangeCode(code);
    const environment = squareEnvironment();
    const merchantName = await fetchMerchantName(result.access_token, environment, result.merchant_id);

    const tokenData = {
      merchantId: result.merchant_id,
      environment,
      accessTokenEnc: encryptToken(result.access_token),
      refreshTokenEnc: encryptToken(result.refresh_token),
      tokenExpiresAt: new Date(result.expires_at),
      merchantName,
      scopes: [...SQUARE_OAUTH_SCOPES],
    };

    if (onboardingReturn) {
      // Wizard flow: park it against the user until "Create my venue" moves
      // it onto the real restaurant (lib/square/pending.ts). A reconnect
      // replaces whatever was pending — and starts fresh on location, since
      // the previous pick may not exist under the new merchant.
      await prisma.pendingSquareConnection.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...tokenData, locationId: null },
        update: { ...tokenData, locationId: null },
      });
      const url = new URL(onboardingReturn, request.url);
      url.searchParams.set("square", "success");
      return NextResponse.redirect(url);
    }

    await prisma.squareConnection.upsert({
      where: { restaurantId: restaurant!.id },
      create: {
        restaurantId: restaurant!.id,
        ...tokenData,
        connectedByUserId: user.id,
      },
      update: {
        ...tokenData,
        connectedByUserId: user.id,
        // A reconnect starts fresh — the previously chosen location may not
        // exist under the newly connected merchant.
        locationId: null,
        revokedAt: null,
      },
    });

    await audit({
      organizationId: restaurant!.organizationId,
      actorUserId: user.id,
      actorEmail: user.email ?? "",
      action: "square.connected",
      resourceType: "Restaurant",
      resourceId: restaurant!.id,
      metadata: { merchantId: result.merchant_id, environment },
    });

    const url = new URL(SETTINGS_REDIRECT, request.url);
    url.searchParams.set("square", "success");
    return NextResponse.redirect(url);
  } catch {
    // Never surface the underlying error (may reference token material) in
    // the redirect URL or client-visible response.
    return fail(request, redirectTo, "exchange_failed");
  }
}
