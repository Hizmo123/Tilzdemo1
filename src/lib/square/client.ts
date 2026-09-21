import type { SquareConnection } from "@prisma/client";
import { SquareClient, SquareEnvironment } from "square";
import { refreshConnection } from "@/lib/square/oauth";

// Authenticated Square SDK calls for an already-connected venue. Always goes
// through refreshConnection() first so the token used is never stale — it
// only actually calls Square's refresh endpoint when the stored token is
// within its expiry window, otherwise it's a cheap decrypt.
export async function squareClientFor(connection: SquareConnection): Promise<SquareClient> {
  const accessToken = await refreshConnection(connection);
  return new SquareClient({
    token: accessToken,
    environment:
      connection.environment === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  });
}

export async function getMerchant(connection: SquareConnection) {
  const client = await squareClientFor(connection);
  const response = await client.merchants.get({ merchantId: connection.merchantId });
  return response.merchant ?? null;
}

export async function getLocations(connection: SquareConnection) {
  const client = await squareClientFor(connection);
  const response = await client.locations.list();
  return response.locations ?? [];
}
