import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export type VenuePaymentContext =
  | { mode: "mock" }
  | {
      mode: "square";
      squareAppId: string;
      squareLocationId: string;
      squareEnv: string;
    };

// Decides whether a venue's customer card payments go through Square or the
// mock provider. "square" only when there's an active (non-revoked) Square
// connection with a location actually chosen — a connection that exists but
// has no locationId yet (owner hasn't finished Settings → Integrations) must
// NOT silently start routing real card payments, so it falls back to mock.
export async function getVenuePaymentContext(restaurantId: string): Promise<VenuePaymentContext> {
  const connection = await prisma.squareConnection.findUnique({ where: { restaurantId } });
  if (!connection || connection.revokedAt || !connection.locationId) {
    return { mode: "mock" };
  }
  return {
    mode: "square",
    squareAppId: env.squareApplicationId(),
    squareLocationId: connection.locationId,
    squareEnv: env.squareEnv(),
  };
}
