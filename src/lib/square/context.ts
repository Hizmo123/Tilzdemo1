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

// True once this deployment is genuinely live (production build, Square
// pointed at its real production API) — at that point, a venue with no
// Square connection falling back to "mock" would let a customer "pay" a
// real bill with no money actually moving. Reads process.env.SQUARE_ENV
// directly rather than env.squareEnv(), which throws when unset (fine for
// every other caller, which only runs once Square is actually configured;
// wrong here, where "unset" has to mean "not production" instead of a
// crash). ALLOW_MOCK_PAYMENTS=true is the explicit, deliberate override —
// for a staged rollout or a support/demo venue — never a default.
export function mockPaymentsBlocked(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.SQUARE_ENV === "production" &&
    process.env.ALLOW_MOCK_PAYMENTS !== "true"
  );
}

export const MOCK_PAYMENTS_BLOCKED_MESSAGE =
  "Online payment isn't available at this venue yet. Please pay at the counter.";
