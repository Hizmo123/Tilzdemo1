import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { visitUrl } from "@/lib/urls";

// High-entropy value encoded in a stand's printed QR (/s/<qrToken>) — never
// sequential, so it can't be enumerated. Distinct from the stand's internal
// `id` (a plain cuid, never shown anywhere) and from `serial` (human-
// readable, for staff to type in — see nextStandSerial below).
export function generateStandQrToken(): string {
  return generateToken(16);
}

// Serial numbers are sequential and platform-wide ("TZ-000123"), for humans
// — packing slips, the admin fulfilment queue, and what a staff member
// actually types into the "Activate a stand" flow. Never used in a URL.
// count()-based rather than a dedicated counter row: stand creation is a
// low-frequency, payment-triggered action, not a hot path, so the rare race
// is caught by the column's own @unique constraint — same pattern as the
// table-QR unique-bill-per-table retry in lib/bills.ts.
export async function nextStandSerial(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const count = await tx.tillzStand.count();
  return `TZ-${String(count + 1).padStart(6, "0")}`;
}

// The mint core: creates one UNCLAIMED stand bound to an org+restaurant but
// NOT yet to a table — that only happens when a staff member activates it
// by serial (see activateStandBySerial). Reused by the order/fulfilment
// pipeline's payment-success path (one call per StandOrderItem).
export async function mintStand(
  tx: Prisma.TransactionClient | typeof prisma,
  args: { organizationId: string; restaurantId: string },
) {
  const serial = await nextStandSerial(tx);
  return tx.tillzStand.create({
    data: {
      serial,
      qrToken: generateStandQrToken(),
      status: "UNCLAIMED",
      organizationId: args.organizationId,
      restaurantId: args.restaurantId,
    },
  });
}

export type StandResolution =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: "invalid" | "not_setup" };

// Resolves a stand's QR token to wherever it should currently send a
// customer. Re-reads the stand's tableId on every call rather than caching
// anything — that's what makes moving an already-active stand to a
// different table require no reprint.
export async function resolveStand(qrToken: string): Promise<StandResolution> {
  const stand = await prisma.tillzStand.findUnique({ where: { qrToken } });

  if (!stand || stand.status === "DEACTIVATED") {
    return { ok: false, reason: "invalid" };
  }
  if (stand.status !== "ACTIVE" || !stand.tableId) {
    return { ok: false, reason: "not_setup" };
  }

  // Reuse the exact same "this table's current visit token" lookup the
  // dashboard's own QR download route uses (see
  // dashboard/tables/[tableId]/qr/route.ts) — a stand is just another way to
  // reach the same /v/<token> flow, never a parallel ordering path.
  const activeToken = await prisma.qrToken.findFirst({
    where: { tableId: stand.tableId, active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!activeToken) {
    return { ok: false, reason: "not_setup" };
  }

  return { ok: true, redirectTo: visitUrl(activeToken.token) };
}

export type ActivateResult =
  | { ok: true }
  | { error: string };

// The activation flow that never existed before this rebuild: a staff
// member reads the serial off a physical stand and types it in, picking
// which table it's going on. This is the ONLY way a stand's tableId is ever
// set — never automatic on ship/print. Scoped to the caller's own
// restaurant on both ends (the stand and the target table).
export async function activateStandBySerial(args: {
  organizationId: string;
  restaurantId: string;
  serial: string;
  tableId: string;
}): Promise<ActivateResult> {
  const stand = await prisma.tillzStand.findFirst({
    where: { serial: args.serial.trim(), organizationId: args.organizationId },
  });
  if (!stand) return { error: "No stand found with that serial for this venue." };
  if (stand.status === "DEACTIVATED") {
    return { error: "This stand has been deactivated and can't be reactivated here." };
  }
  if (stand.status === "ACTIVE") {
    return { error: "This stand is already active. Move it from its current table instead." };
  }

  const table = await prisma.table.findFirst({
    where: { id: args.tableId, location: { restaurantId: args.restaurantId } },
  });
  if (!table) return { error: "That table wasn't found." };

  await prisma.tillzStand.update({
    where: { id: stand.id },
    data: { status: "ACTIVE", tableId: table.id, restaurantId: args.restaurantId },
  });
  return { ok: true };
}
