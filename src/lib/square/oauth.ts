import type { SquareConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { encryptToken, decryptToken } from "@/lib/square/crypto";
import { squareEnvironment, squareBaseUrl, SQUARE_OAUTH_SCOPES } from "@/lib/square/config";

// Server-to-server OAuth calls against Square's own /oauth2/* endpoints — not
// the Square SDK client (that's for authenticated API calls once connected,
// see src/lib/square/client.ts). Token fields never leave this module as
// plaintext except transiently in memory to hand to callers that need the
// live access token for one request.

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // refresh within 7 days of expiry

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.squareApplicationId(),
    scope: SQUARE_OAUTH_SCOPES.join(" "),
    session: "false",
    redirect_uri: env.squareRedirectUrl(),
    state,
  });
  return `${squareBaseUrl()}/oauth2/authorize?${params.toString()}`;
}

type SquareTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO 8601
  merchant_id: string;
};

async function tokenRequest(body: Record<string, string>): Promise<SquareTokenResponse> {
  const res = await fetch(`${squareBaseUrl()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.squareApplicationId(),
      client_secret: env.squareApplicationSecret(),
      ...body,
    }),
  });
  if (!res.ok) {
    // Never log the request body — it carries the client secret and, on a
    // refresh call, the refresh token.
    throw new Error(`Square token request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function exchangeCode(code: string): Promise<SquareTokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.squareRedirectUrl(),
  });
}

// Refreshes and persists a new access token if the connection's current one
// expires within REFRESH_WINDOW_MS. Returns the live (plaintext, in-memory
// only) access token to use for the caller's immediate API call — always
// call this before any Square API request rather than reading
// accessTokenEnc directly.
export async function refreshConnection(connection: SquareConnection): Promise<string> {
  const msUntilExpiry = connection.tokenExpiresAt.getTime() - Date.now();
  if (msUntilExpiry > REFRESH_WINDOW_MS) {
    return decryptToken(connection.accessTokenEnc);
  }

  const refreshToken = decryptToken(connection.refreshTokenEnc);
  const result = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  await prisma.squareConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEnc: encryptToken(result.access_token),
      refreshTokenEnc: encryptToken(result.refresh_token),
      tokenExpiresAt: new Date(result.expires_at),
    },
  });

  return result.access_token;
}

export async function revoke(connection: SquareConnection): Promise<void> {
  const accessToken = decryptToken(connection.accessTokenEnc);
  const res = await fetch(`${squareBaseUrl(connection.environment as "sandbox" | "production")}/oauth2/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Client ${env.squareApplicationSecret()}`,
    },
    body: JSON.stringify({
      client_id: env.squareApplicationId(),
      access_token: accessToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Square token revoke failed: ${res.status} ${res.statusText}`);
  }
}

export { squareEnvironment };
