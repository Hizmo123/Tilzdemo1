import type { PendingSquareConnection, Prisma, SquareConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocations } from "@/lib/square/client";
import { revoke } from "@/lib/square/oauth";

// Square connected DURING onboarding, before the Restaurant exists. The OAuth
// callback parks the result in PendingSquareConnection (keyed by user);
// these helpers read it back for the wizard (never the tokens), let the
// wizard pick a location, and move it onto the real restaurant when the
// wizard completes. See prisma/schema.prisma#PendingSquareConnection.

// What the wizard is allowed to see. No token material, ever.
export type PendingSquareSummary = {
  merchantName: string | null;
  environment: string;
  locationId: string | null;
};

export async function getPendingSquareSummary(userId: string): Promise<PendingSquareSummary | null> {
  const row = await prisma.pendingSquareConnection.findUnique({
    where: { userId },
    select: { merchantName: true, environment: true, locationId: true },
  });
  return row;
}

// Presents a pending row in SquareConnection's shape so the existing
// authenticated-client helpers (getLocations etc.) work on it unchanged.
// refreshConnection() only writes back to squareConnection when the token is
// within 7 days of expiry — a token minted minutes ago in this same wizard
// session never is, so the placeholder id below is never used for a write.
function asConnection(p: PendingSquareConnection): SquareConnection {
  return {
    id: `pending:${p.userId}`,
    restaurantId: "",
    merchantId: p.merchantId,
    environment: p.environment,
    accessTokenEnc: p.accessTokenEnc,
    refreshTokenEnc: p.refreshTokenEnc,
    tokenExpiresAt: p.tokenExpiresAt,
    locationId: p.locationId,
    merchantName: p.merchantName,
    scopes: p.scopes,
    connectedByUserId: p.userId,
    revokedAt: null,
    lastCatalogSyncAt: null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function listPendingLocations(userId: string): Promise<{ id: string; name: string }[]> {
  const row = await prisma.pendingSquareConnection.findUnique({ where: { userId } });
  if (!row) return [];
  const locations = await getLocations(asConnection(row));
  return locations.map((l) => ({ id: l.id ?? "", name: l.name ?? l.id ?? "Location" }));
}

export async function setPendingLocation(userId: string, locationId: string): Promise<void> {
  await prisma.pendingSquareConnection.update({ where: { userId }, data: { locationId } });
}

// Best-effort revoke at Square, then drop the row — same policy as the
// Settings "Disconnect": a failed revoke must never leave the owner unable
// to walk away from a connection on Tillz's side.
export async function discardPending(userId: string): Promise<void> {
  const row = await prisma.pendingSquareConnection.findUnique({ where: { userId } });
  if (!row) return;
  try {
    await revoke(asConnection(row));
  } catch {
    // Intentionally ignored — see comment above.
  }
  await prisma.pendingSquareConnection.delete({ where: { userId } });
}

// Inside the venue-creation transaction: turn the pending row into the new
// restaurant's SquareConnection and delete the pending row. Returns what the
// caller needs for its audit entry, or null when there was nothing pending.
export async function attachPendingToRestaurant(
  tx: Prisma.TransactionClient,
  userId: string,
  restaurantId: string,
): Promise<{ merchantId: string; environment: string } | null> {
  const p = await tx.pendingSquareConnection.findUnique({ where: { userId } });
  if (!p) return null;

  const data = {
    merchantId: p.merchantId,
    environment: p.environment,
    accessTokenEnc: p.accessTokenEnc,
    refreshTokenEnc: p.refreshTokenEnc,
    tokenExpiresAt: p.tokenExpiresAt,
    merchantName: p.merchantName,
    scopes: p.scopes,
    locationId: p.locationId,
    connectedByUserId: userId,
    revokedAt: null,
  };
  await tx.squareConnection.upsert({
    where: { restaurantId },
    create: { restaurantId, ...data },
    update: data,
  });
  await tx.pendingSquareConnection.delete({ where: { userId } });
  return { merchantId: p.merchantId, environment: p.environment };
}
