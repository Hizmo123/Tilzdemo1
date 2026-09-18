import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { visitUrl } from "@/lib/urls";

// High-entropy id for a physical stand — this is the value in the QR/URL
// (/s/<id>), so it must never be sequential or otherwise guessable. 16 chars
// over the same alphabet as visit tokens is ~93 bits of entropy.
export function generateStandId(): string {
  return generateToken(16);
}

// Serial numbers are sequential and platform-wide ("TZ-000123"), for humans —
// packing slips, the admin fulfilment queue, a caption on the printed card
// itself so a batch of 20 doesn't get mixed up. Never used in a URL.
// Allocated from a plain count() rather than a dedicated counter row: stand
// creation is a low-frequency, staff/payment-triggered action, not a hot
// path, so the rare race (two orders paying in the same instant) is caught
// by the column's own @unique constraint and left for the caller to retry —
// same pattern as the table-QR unique-bill-per-table retry in lib/bills.ts.
export async function nextStandSerial(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const count = await tx.tillzStand.count();
  return `TZ-${String(count + 1).padStart(6, "0")}`;
}

export type StandResolution =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: "invalid" | "not_setup" };

// Resolves a stand's QR id to wherever it should currently send a customer.
// Deliberately re-reads the stand's tableId on every call rather than caching
// or baking a token into the stand row — that's what makes moving a stand to
// a different table (Task 5) require no reprint: the QR itself never
// changes, only what it resolves to.
export async function resolveStand(id: string): Promise<StandResolution> {
  const stand = await prisma.tillzStand.findUnique({ where: { id } });

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
