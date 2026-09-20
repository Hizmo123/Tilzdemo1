import { prisma } from "@/lib/prisma";
import { notifyRestaurant } from "@/lib/realtime";

// Cash drawer / shift session lib — cross-checked by, but not itself gated on,
// requireStaffForSlug: every caller (src/app/staff/[slug]/register/actions.ts)
// resolves the staff session first and passes in the staffId/staffName this
// file writes onto its rows. Nothing here re-authenticates on its own.

export type StaffRef = { id: string; name: string };

export type CashActionResult<T> = { ok: true; data: T } | { error: string };

// Opens a new drawer session for a location. Rejects if one is already open
// there — at most one OPEN session per location at a time (see the schema
// comment on CashDrawerSession for why this is an application-level check,
// not a DB constraint).
export async function openSession(
  restaurantId: string,
  locationId: string,
  staff: StaffRef,
  openingFloatCents: number,
): Promise<CashActionResult<{ id: string }>> {
  if (!Number.isInteger(openingFloatCents) || openingFloatCents < 0) {
    return { error: "Enter a valid opening float." };
  }

  const location = await prisma.location.findFirst({
    where: { id: locationId, restaurantId },
  });
  if (!location) return { error: "Location not found." };

  const existing = await prisma.cashDrawerSession.findFirst({
    where: { locationId, status: "OPEN" },
  });
  if (existing) return { error: "A drawer is already open for this location." };

  const session = await prisma.cashDrawerSession.create({
    data: {
      restaurantId,
      locationId,
      openedByStaffId: staff.id,
      openedByName: staff.name,
      openingFloatCents,
    },
  });

  return { ok: true, data: { id: session.id } };
}

export async function getOpenSession(restaurantId: string, locationId: string) {
  return prisma.cashDrawerSession.findFirst({
    where: { restaurantId, locationId, status: "OPEN" },
  });
}

// Paid-in (e.g. petty cash added) or paid-out (e.g. a safe drop) adjustment
// against an open drawer. amountCents is always positive — the type
// (PAID_IN/PAID_OUT) carries the direction, folded into getZReport's
// expectedCashCents accordingly.
export async function recordMovement(
  sessionId: string,
  restaurantId: string,
  type: "PAID_IN" | "PAID_OUT",
  amountCents: number,
  reason: string,
  staff: StaffRef,
): Promise<CashActionResult<{ id: string }>> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  const cleanReason = reason.trim().slice(0, 200);
  if (!cleanReason) return { error: "Enter a reason." };

  const session = await prisma.cashDrawerSession.findFirst({
    where: { id: sessionId, restaurantId, status: "OPEN" },
  });
  if (!session) return { error: "That drawer session isn't open." };

  const movement = await prisma.cashMovement.create({
    data: {
      cashSessionId: session.id,
      type,
      amountCents,
      reason: cleanReason,
      staffId: staff.id,
      staffName: staff.name,
    },
  });

  await notifyRestaurant(restaurantId);
  return { ok: true, data: { id: movement.id } };
}

export type ZReport = {
  sessionId: string;
  openedAt: Date;
  openedByName: string;
  closedAt: Date | null;
  closedByName: string | null;
  status: "OPEN" | "CLOSED";
  openingFloatCents: number;
  salesByTender: { cash: number; card: number; other: number };
  refundsCents: number;
  paidInCents: number;
  paidOutCents: number;
  expectedCashCents: number;
  countedCashCents: number | null;
  varianceCents: number | null;
  transactionCount: number;
  grossCents: number;
  netCents: number;
};

// Computes the Z-report for a session — every figure derived server-side from
// Payment/Refund/CashMovement rows, never trusted from a client. Works for
// both an open session (expectedCashCents so far, no variance yet) and a
// closed one (variance against the counted total recorded at close).
export async function getZReport(
  sessionId: string,
  restaurantId: string,
): Promise<ZReport | null> {
  const session = await prisma.cashDrawerSession.findFirst({
    where: { id: sessionId, restaurantId },
    include: {
      payments: {
        where: { status: "SUCCEEDED" },
        include: { refunds: { where: { status: "SUCCEEDED" } } },
      },
      movements: true,
    },
  });
  if (!session) return null;

  const salesByTender = { cash: 0, card: 0, other: 0 };
  let refundsCents = 0;
  let grossCents = 0;

  for (const p of session.payments) {
    // Revenue for this payment: what the venue actually received (amount +
    // tip; surcharge is a pass-through cost recovery, not revenue proper, but
    // it did land in the drawer for cash, so include it in gross too).
    const receivedCents = p.amountCents + p.tipCents + p.surchargeCents;
    grossCents += receivedCents;
    if (p.tenderType === "CASH") salesByTender.cash += receivedCents;
    else if (p.tenderType === "CARD") salesByTender.card += receivedCents;
    else salesByTender.other += receivedCents;

    for (const r of p.refunds) refundsCents += r.amountCents;
  }

  let paidInCents = 0;
  let paidOutCents = 0;
  for (const m of session.movements) {
    if (m.type === "PAID_IN") paidInCents += m.amountCents;
    else paidOutCents += m.amountCents;
  }

  // Only cash refunds actually leave the drawer — a card refund reverses on
  // the processor, never physical cash — but tenderType isn't recorded on
  // Refund itself, so this conservatively assumes any refund against a cash
  // payment came back out of the drawer as cash. Good enough for a mock-
  // provider cash reconciliation; a real processor integration would refine
  // this per refund method.
  const cashRefundsCents = session.payments
    .filter((p) => p.tenderType === "CASH")
    .reduce((sum, p) => sum + p.refunds.reduce((s, r) => s + r.amountCents, 0), 0);

  const expectedCashCents =
    session.openingFloatCents +
    salesByTender.cash -
    cashRefundsCents +
    paidInCents -
    paidOutCents;

  const netCents = grossCents - refundsCents;

  return {
    sessionId: session.id,
    openedAt: session.openedAt,
    openedByName: session.openedByName,
    closedAt: session.closedAt,
    closedByName: session.closedByName,
    status: session.status,
    openingFloatCents: session.openingFloatCents,
    salesByTender,
    refundsCents,
    paidInCents,
    paidOutCents,
    expectedCashCents,
    countedCashCents: session.countedCashCents,
    varianceCents:
      session.countedCashCents != null ? session.countedCashCents - expectedCashCents : null,
    transactionCount: session.payments.length,
    grossCents,
    netCents,
  };
}

// Closes a session — sets status CLOSED, records who/when and the counted
// cash total — then returns the final Z-report (with variance computed
// against that count).
export async function closeSession(
  sessionId: string,
  restaurantId: string,
  staff: StaffRef,
  countedCashCents: number,
): Promise<CashActionResult<ZReport>> {
  if (!Number.isInteger(countedCashCents) || countedCashCents < 0) {
    return { error: "Enter a valid counted cash total." };
  }

  const session = await prisma.cashDrawerSession.findFirst({
    where: { id: sessionId, restaurantId, status: "OPEN" },
  });
  if (!session) return { error: "That drawer session isn't open." };

  await prisma.cashDrawerSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedByStaffId: staff.id,
      closedByName: staff.name,
      countedCashCents,
    },
  });

  await notifyRestaurant(restaurantId);

  const report = await getZReport(session.id, restaurantId);
  if (!report) return { error: "Session closed, but the report couldn't be built." };
  return { ok: true, data: report };
}

// Recent sessions for history — most recently opened first.
export async function listSessions(
  restaurantId: string,
  locationId?: string,
  limit = 20,
) {
  return prisma.cashDrawerSession.findMany({
    where: { restaurantId, ...(locationId ? { locationId } : {}) },
    orderBy: { openedAt: "desc" },
    take: limit,
  });
}
