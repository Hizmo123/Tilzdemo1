import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthz } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { exchangeCode, squareEnvironment } from "@/lib/square/oauth";
import { encryptToken } from "@/lib/square/crypto";
import { squareBaseUrl, SQUARE_OAUTH_SCOPES } from "@/lib/square/config";
import { SQUARE_OAUTH_STATE_COOKIE } from "@/app/api/square/authorize/route";

const REDIRECT_TO = "/dashboard/settings/integrations";

function fail(request: NextRequest, reason: string) {
  const url = new URL(REDIRECT_TO, request.url);
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
  const authz = await getAuthz();
  if (!authz.can("settings:manage")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const restaurant = authz.membership?.organization.restaurants[0];
  if (!restaurant) {
    return new NextResponse("Not found", { status: 404 });
  }

  const sp = request.nextUrl.searchParams;
  const error = sp.get("error");
  if (error) return fail(request, error);

  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return fail(request, "missing_params");

  const jar = await cookies();
  const expectedState = jar.get(SQUARE_OAUTH_STATE_COOKIE)?.value;
  jar.delete(SQUARE_OAUTH_STATE_COOKIE);
  if (!expectedState || expectedState !== state) {
    return fail(request, "state_mismatch");
  }

  try {
    const result = await exchangeCode(code);
    const environment = squareEnvironment();
    const merchantName = await fetchMerchantName(result.access_token, environment, result.merchant_id);

    await prisma.squareConnection.upsert({
      where: { restaurantId: restaurant.id },
      create: {
        restaurantId: restaurant.id,
        merchantId: result.merchant_id,
        environment,
        accessTokenEnc: encryptToken(result.access_token),
        refreshTokenEnc: encryptToken(result.refresh_token),
        tokenExpiresAt: new Date(result.expires_at),
        merchantName,
        scopes: [...SQUARE_OAUTH_SCOPES],
        connectedByUserId: authz.user.id,
      },
      update: {
        merchantId: result.merchant_id,
        environment,
        accessTokenEnc: encryptToken(result.access_token),
        refreshTokenEnc: encryptToken(result.refresh_token),
        tokenExpiresAt: new Date(result.expires_at),
        merchantName,
        scopes: [...SQUARE_OAUTH_SCOPES],
        connectedByUserId: authz.user.id,
        // A reconnect starts fresh — the previously chosen location may not
        // exist under the newly connected merchant.
        locationId: null,
        revokedAt: null,
      },
    });

    await audit({
      organizationId: restaurant.organizationId,
      actorUserId: authz.user.id,
      actorEmail: authz.user.email ?? "",
      action: "square.connected",
      resourceType: "Restaurant",
      resourceId: restaurant.id,
      metadata: { merchantId: result.merchant_id, environment },
    });

    const url = new URL(REDIRECT_TO, request.url);
    url.searchParams.set("square", "success");
    return NextResponse.redirect(url);
  } catch {
    // Never surface the underlying error (may reference token material) in
    // the redirect URL or client-visible response.
    return fail(request, "exchange_failed");
  }
}
