import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { sendSms } from "@/lib/sms";
import { normalizeAuPhone } from "@/lib/phone";

// ---- Visit resolution -------------------------------------------------------

export type VisitInvalid =
  | "not_found"
  | "code_revoked"
  | "table_inactive";

export type ResolvedVisit = {
  tableId: string;
  tableLabel: string;
  tableSection: string | null;
  locationName: string;
  restaurantId: string;
  restaurantName: string;
  currency: string;
  timezone: string;
  hours: unknown;
  logoUrl: string | null;
  coverUrl: string | null;
  bgImageUrl: string | null;
  brandColor: string | null;
  theme: string;
  themeMode: string;
  fontTheme: string;
  tipEnabled: boolean;
  tipPresets: number[];
  customerOrdering: boolean;
  customerPayment: boolean;
  staffApproval: boolean;
  paymentTiming: string;
};

// Resolves an opaque visit token to its table/restaurant, or an invalid reason.
// Used by both the customer page and the customer actions, so the same rules
// (revoked token, inactive table) are enforced everywhere.
export async function resolveVisit(
  token: string,
): Promise<{ ok: true; visit: ResolvedVisit } | { ok: false; reason: VisitInvalid }> {
  const qr = await prisma.qrToken.findUnique({
    where: { token },
    include: {
      table: { include: { location: { include: { restaurant: true } } } },
    },
  });

  if (!qr) return { ok: false, reason: "not_found" };
  if (!qr.active) return { ok: false, reason: "code_revoked" };
  if (!qr.table.active) return { ok: false, reason: "table_inactive" };

  const r = qr.table.location.restaurant;
  return {
    ok: true,
    visit: {
      tableId: qr.table.id,
      tableLabel: qr.table.label,
      tableSection: qr.table.section,
      locationName: qr.table.location.name,
      restaurantId: r.id,
      restaurantName: r.name,
      currency: r.currency,
      timezone: r.timezone,
      hours: r.hours,
      logoUrl: r.logoUrl,
      coverUrl: r.coverUrl,
      bgImageUrl: r.bgImageUrl,
      brandColor: r.brandColor,
      theme: r.theme,
      themeMode: r.themeMode,
      fontTheme: r.fontTheme,
      tipEnabled: r.tipEnabled,
      tipPresets: r.tipPresets,
      customerOrdering: r.customerOrdering,
      customerPayment: r.customerPayment,
      staffApproval: r.staffApproval,
      paymentTiming: r.paymentTiming,
    },
  };
}

// ---- Menu -------------------------------------------------------------------

export async function getMenuForCustomer(restaurantId: string) {
  return prisma.menuCategory.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          modifierGroups: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              options: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              },
            },
          },
        },
      },
    },
  });
}

// ---- Bill reads -------------------------------------------------------------

export async function getOpenBillWithItems(tableId: string) {
  return prisma.bill.findFirst({
    where: { tableId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
}

// ---- Add items --------------------------------------------------------------

// Recompute a bill's subtotal/total from its line items. Total == subtotal for
// now (AU prices are GST-inclusive; tip/discount arrive later). Always call this
// after mutating items so stored totals can never drift from the lines.
async function recompute(tx: Prisma.TransactionClient, billId: string) {
  const items = await tx.billItem.findMany({ where: { billId } });
  // Voided lines are removed entirely; comped lines stay on the ticket but are
  // charged at $0. Both are excluded from the subtotal.
  const subtotal = items.reduce(
    (sum, it) => (it.voided || it.comped ? sum : sum + it.lineTotalCents),
    0,
  );
  const current = await tx.bill.findUnique({
    where: { id: billId },
    select: { discountCents: true },
  });
  const discount = Math.min(current?.discountCents ?? 0, subtotal);
  const total = Math.max(0, subtotal - discount);
  await tx.bill.update({
    where: { id: billId },
    data: { subtotalCents: subtotal, totalCents: total },
  });
}

export type AddItem = {
  menuItemId: string;
  quantity: number;
  optionIds?: string[];
};

export type ModifierSnapshot = {
  group: string;
  name: string;
  deltaCents: number;
};

// Adds menu items to the table's open bill. Prices come from the DB, never the
// client (spec §15, §145): the client only sends item ids and quantities. Item
// name and price are snapshotted onto the bill line (spec §105).
export async function addItemsToBill(
  token: string,
  items: AddItem[],
  note?: string,
  clientRequestId?: string,
) {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };
  const { tableId, restaurantId, currency } = resolved.visit;
  return addItemsForTable(
    { tableId, restaurantId, currency },
    items,
    "CUSTOMER",
    note,
    clientRequestId,
  );
}

// Internal control-flow signals thrown to roll the transaction back. Returning
// from a $transaction callback COMMITS it — only throwing rolls it back — so a
// bad line or an empty send must throw, not return, or partial writes would be
// committed while the caller reports an error.
class LineError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}
class EmptySend extends Error {}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

// True when a P2002 unique violation is on the given field (via error meta),
// so we can tell the "duplicate order submit" case apart from the "two carts
// raced to open the table's bill" case.
function uniqueTargetIncludes(e: unknown, field: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return false;
}

// Shared core: adds menu items to a table's open bill, priced from the DB. Used
// by both the customer flow (resolved from a QR token) and staff taking an order
// at the table (resolved from a staff session). The caller must have already
// established that tableId belongs to restaurantId.
export async function addItemsForTable(
  target: { tableId: string; restaurantId: string; currency: string },
  items: AddItem[],
  source: "CUSTOMER" | "STAFF" = "CUSTOMER",
  note?: string,
  clientRequestId?: string,
) {
  const { tableId, restaurantId, currency } = target;
  const cleanNote = note?.trim().slice(0, 200) || null;
  const idemKey = clientRequestId?.trim() || null;

  // Idempotency: if this exact submit already landed (double-tap, or a retried
  // request after a dropped response), don't create a second order — report the
  // original as success.
  if (idemKey) {
    const existing = await prisma.order.findUnique({
      where: { clientRequestId: idemKey },
    });
    if (existing) return { ok: true as const };
  }

  // Each cart line is kept distinct — different modifier selections mean
  // different lines, so no merging within the send either.
  const lines = items.filter(
    (i) => i.menuItemId && Number.isInteger(i.quantity) && i.quantity > 0,
  );
  if (lines.length === 0) return { error: "Nothing to add." };

  // A DB-level partial unique index guarantees at most one OPEN/PARTIALLY_PAID
  // bill per table (see prisma/sql/one-open-bill-per-table.sql). If two sends
  // race to create the first bill, one wins and the other hits a unique
  // violation — we retry, and the retry finds the winner's bill instead of
  // creating a second one.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        // Find-or-create the single open bill for this table.
        let bill = await tx.bill.findFirst({
          where: { tableId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
          orderBy: { createdAt: "desc" },
        });
        if (!bill) {
          bill = await tx.bill.create({ data: { tableId, currency } });
        }

        // Allocate a human order number (atomic per-venue counter) and read the
        // service settings in the same row update.
        const rest = await tx.restaurant.update({
          where: { id: restaurantId },
          data: { orderSeq: { increment: 1 } },
          select: { orderSeq: true, staffApproval: true, paymentTiming: true },
        });
        // Release gates for CUSTOMER orders (a waiter's own order is never held):
        //  - approval: staff must accept before the kitchen sees it.
        //  - payment: prepay venue — the kitchen never sees it until it's paid.
        const awaitingApproval = source === "CUSTOMER" && rest.staffApproval;
        const awaitingPayment =
          source === "CUSTOMER" && rest.paymentTiming === "before";
        const held = awaitingApproval || awaitingPayment;

        // One order ticket per send.
        const order = await tx.order.create({
          data: {
            billId: bill.id,
            tableId,
            restaurantId,
            source,
            note: cleanNote,
            clientRequestId: idemKey,
            orderNumber: rest.orderSeq,
            status: held ? "PENDING" : "SUBMITTED",
            awaitingApproval,
            awaitingPayment,
          },
        });

        let added = 0;
        for (const line of lines) {
          // Verify the item belongs to THIS restaurant and is available, and
          // load its modifier groups/options — the server is the price authority.
          const item = await tx.menuItem.findFirst({
            where: {
              id: line.menuItemId,
              available: true,
              category: { restaurantId },
            },
            include: {
              category: { select: { station: true } },
              modifierGroups: { include: { options: true } },
            },
          });
          if (!item) continue; // silently skip unavailable/foreign items

          const resolved = resolveModifiers(item, line.optionIds ?? []);
          if ("error" in resolved) throw new LineError(resolved.error); // rolls back the whole send

          const qty = Math.min(line.quantity, 99);

          await tx.billItem.create({
            data: {
              billId: bill.id,
              orderId: order.id,
              menuItemId: item.id,
              nameSnapshot: item.name,
              unitPriceCents: resolved.unitPriceCents,
              modifiers: resolved.modifiers.length
                ? (resolved.modifiers as object[])
                : undefined,
              quantity: qty,
              lineTotalCents: resolved.unitPriceCents * qty,
              station: item.category?.station ?? null,
            },
          });
          added++;
        }

        // Nothing landed — throw so the order (and a just-created bill) roll
        // back rather than leaving an empty ticket behind.
        if (added === 0) throw new EmptySend();

        await recompute(tx, bill.id);
      });

      return { ok: true as const };
    } catch (e) {
      if (e instanceof LineError) return { error: e.reason };
      if (e instanceof EmptySend) return { error: "Those items aren't available." };
      if (isUniqueViolation(e)) {
        // Two identical submits raced: the other one won, so this is a
        // duplicate, not a failure — report success.
        if (uniqueTargetIncludes(e, "clientRequestId")) return { ok: true as const };
        // Two carts raced to open this table's bill — re-read and retry.
        if (attempt < 2) continue;
      }
      throw e;
    }
  }

  return { error: "This table is busy right now. Please try again." };
}

// Validates a line's modifier selection against the item's groups and returns
// the resolved unit price (base + option deltas) plus a display snapshot, or an
// error. This is the pricing authority — client-sent prices are never trusted.
type ItemWithMods = {
  priceCents: number;
  modifierGroups: {
    id: string;
    name: string;
    required: boolean;
    maxSelect: number;
    options: { id: string; name: string; priceDeltaCents: number }[];
  }[];
};

function resolveModifiers(
  item: ItemWithMods,
  optionIds: string[],
): { unitPriceCents: number; modifiers: ModifierSnapshot[] } | { error: string } {
  const optMap = new Map<
    string,
    { name: string; priceDeltaCents: number; groupId: string; groupName: string }
  >();
  for (const g of item.modifierGroups)
    for (const o of g.options)
      optMap.set(o.id, {
        name: o.name,
        priceDeltaCents: o.priceDeltaCents,
        groupId: g.id,
        groupName: g.name,
      });

  for (const id of optionIds)
    if (!optMap.has(id)) return { error: "That option isn't available." };

  const perGroup = new Map<string, number>();
  for (const id of optionIds) {
    const o = optMap.get(id)!;
    perGroup.set(o.groupId, (perGroup.get(o.groupId) ?? 0) + 1);
  }
  for (const g of item.modifierGroups) {
    const count = perGroup.get(g.id) ?? 0;
    if (g.required && count < 1) return { error: `Please choose ${g.name}.` };
    if (g.maxSelect > 0 && count > g.maxSelect)
      return { error: `Too many choices for ${g.name}.` };
  }

  let delta = 0;
  const modifiers: ModifierSnapshot[] = [];
  for (const id of optionIds) {
    const o = optMap.get(id)!;
    delta += o.priceDeltaCents;
    modifiers.push({ group: o.groupName, name: o.name, deltaCents: o.priceDeltaCents });
  }
  return { unitPriceCents: item.priceCents + delta, modifiers };
}

// ---- Order lifecycle (kitchen tickets) -------------------------------------

export type OrderStatusName =
  | "PENDING"
  | "SUBMITTED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "CANCELLED";

// Allowed forward transitions. PENDING (awaiting staff approval) becomes
// SUBMITTED once accepted, or CANCELLED if rejected. A ticket can jump ahead
// (e.g. straight to SERVED) but never move backwards; SERVED/CANCELLED terminal.
const NEXT_STATUSES: Record<OrderStatusName, OrderStatusName[]> = {
  PENDING: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["PREPARING", "READY", "SERVED", "CANCELLED"],
  PREPARING: ["READY", "SERVED", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

export function canTransition(
  from: OrderStatusName,
  to: OrderStatusName,
): boolean {
  return NEXT_STATUSES[from]?.includes(to) ?? false;
}

// Advances an order's status, restaurant-scoped so a caller can only touch their
// own venue's tickets. Validates the transition. Sets servedAt on SERVED.
export async function advanceOrderStatus(
  orderId: string,
  restaurantId: string,
  to: OrderStatusName,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: { bill: true },
  });
  if (!order) return { error: "Order not found." };
  if (!canTransition(order.status as OrderStatusName, to)) {
    return { error: "That status change isn't allowed." };
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { status: to, servedAt: to === "SERVED" ? new Date() : order.servedAt },
  });

  // "Order ready" SMS — once per bill, only when a phone was left.
  if (
    to === "READY" &&
    order.bill.customerPhone &&
    !order.bill.readyNotifiedAt
  ) {
    const r = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true },
    });
    const num = order.orderNumber != null ? `#${order.orderNumber}` : "your order";
    await sendSms(
      order.bill.customerPhone,
      `${r?.name ?? "Your order"}: order ${num} is ready to collect. Thanks!`,
    );
    await prisma.bill.update({
      where: { id: order.billId },
      data: { readyNotifiedAt: new Date() },
    });
  }

  return { ok: true as const };
}

// Active kitchen tickets for a restaurant (not yet served or cancelled).
export async function getKitchenOrders(restaurantId: string) {
  return prisma.order.findMany({
    where: {
      restaurantId,
      status: { in: ["SUBMITTED", "PREPARING", "READY"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      bill: { include: { table: true } },
    },
  });
}

// ---- Staff approval queue (when staffApproval is on) -----------------------

// Customer orders waiting for a staff member to accept them. Payment-held
// orders (prepay, not yet paid) are deliberately excluded — staff have nothing
// to do with those; they release themselves when the customer pays.
export async function getPendingApprovals(restaurantId: string) {
  return prisma.order.findMany({
    where: { restaurantId, status: "PENDING", awaitingApproval: true },
    orderBy: { createdAt: "asc" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      bill: { include: { table: true } },
    },
  });
}

// Accept a pending order. Clears the approval gate; the order reaches the
// kitchen only if it isn't also still waiting on prepayment.
export async function staffApproveOrder(orderId: string, restaurantId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId, status: "PENDING" },
  });
  if (!order) return { error: "Order not found." };

  const stillHeld = order.awaitingPayment; // payment gate not yet cleared
  await prisma.order.update({
    where: { id: order.id },
    data: {
      awaitingApproval: false,
      status: stillHeld ? "PENDING" : "SUBMITTED",
    },
  });
  return { ok: true as const };
}

// Release any orders on a bill that were held ONLY for payment, once the bill is
// settled. Orders still awaiting staff approval stay held (payment gate cleared).
// Called by every pay path when the bill becomes fully paid.
async function releasePaidOrders(billId: string) {
  await prisma.order.updateMany({
    where: {
      billId,
      status: "PENDING",
      awaitingPayment: true,
      awaitingApproval: false,
    },
    data: { awaitingPayment: false, status: "SUBMITTED" },
  });
  await prisma.order.updateMany({
    where: { billId, status: "PENDING", awaitingPayment: true, awaitingApproval: true },
    data: { awaitingPayment: false },
  });
}

// Reject a pending order → cancel it and take its items back off the bill.
export async function staffRejectOrder(orderId: string, restaurantId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId, status: "PENDING" },
  });
  if (!order) return { error: "Order not found." };

  await prisma.$transaction(async (tx) => {
    await tx.billItem.deleteMany({ where: { orderId: order.id } });
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
    await recompute(tx, order.billId);
  });
  return { ok: true as const };
}

// ---- Pay --------------------------------------------------------------------

export type PayResult =
  | { paid: true; amountPaidCents: number; tipCents: number; fullyPaid: boolean; test: boolean }
  | { error: string };

// Pays a chosen amount toward the table's open bill, safely under concurrency.
// Multiple people can pay the same bill at once (spec §12, §16); this must never
// allocate more than the outstanding balance. The requested amount is clamped to
// the remaining balance (so a split share that rounds high still closes the bill
// exactly, and overpayment is impossible — spec §11), and applied with an atomic
// compare-and-swap on amountPaidCents so two concurrent payments can't both win
// against the same balance.
//
// requestedCents = null means "pay the full remaining balance".
export async function payBillAmount(
  token: string,
  requestedCents: number | null,
  tipCents = 0,
): Promise<PayResult> {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };

  if (
    requestedCents !== null &&
    (!Number.isInteger(requestedCents) || requestedCents <= 0)
  ) {
    return { error: "Enter a valid amount." };
  }
  const tip = Number.isInteger(tipCents) && tipCents > 0 ? tipCents : 0;

  const provider = getPaymentProvider();

  // Retry the read → validate → CAS cycle a few times; a lost CAS means another
  // payer moved the balance between our read and write, so we re-read and retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const bill = await getOpenBillWithItems(resolved.visit.tableId);
    if (!bill) return { error: "There's no open bill to pay." };

    const remaining = bill.totalCents - bill.amountPaidCents;
    if (remaining <= 0) {
      return { paid: true, amountPaidCents: 0, tipCents: 0, fullyPaid: true, test: provider.isTest };
    }

    // Clamp to the outstanding balance — never charge more than is owed.
    const amount = Math.min(requestedCents ?? remaining, remaining);
    if (amount <= 0) return { error: "Enter a valid amount." };

    const expectedPaid = bill.amountPaidCents;
    const newPaid = expectedPaid + amount;
    const fullyPaid = newPaid >= bill.totalCents;

    // Atomic reserve: only succeeds if amountPaidCents is still what we read.
    // The mock provider always succeeds, so reserving before recording the
    // payment needs no release path. (With a real provider, M3 adds
    // reserve → charge → webhook-confirm, releasing on failure.)
    const cas = await prisma.bill.updateMany({
      where: {
        id: bill.id,
        amountPaidCents: expectedPaid,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
      data: {
        amountPaidCents: newPaid,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        paidAt: fullyPaid ? new Date() : null,
      },
    });

    if (cas.count !== 1) continue; // lost the race — re-read and retry

    // Balance reserved. Charge the provider (amount + any tip) and record it.
    const idempotencyKey = `pay_${bill.id}_${randomBytes(8).toString("hex")}`;
    const result = await provider.createPayment({
      amountCents: amount + tip,
      currency: bill.currency,
      idempotencyKey,
      metadata: { billId: bill.id, tipCents: String(tip) },
    });

    await prisma.payment.create({
      data: {
        billId: bill.id,
        amountCents: amount,
        tipCents: tip,
        currency: bill.currency,
        status: result.status,
        provider: provider.name,
        providerRef: result.providerRef,
        idempotencyKey,
        test: result.test,
      },
    });

    // Tips are additive to the venue, not a reduction of what's owed, so they're
    // accumulated on the bill separately from the balance CAS.
    if (tip > 0) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { tipCents: { increment: tip } },
      });
    }

    // Prepay: settling the bill releases any orders that were held for payment.
    if (fullyPaid) await releasePaidOrders(bill.id);

    return {
      paid: true,
      amountPaidCents: amount,
      tipCents: tip,
      fullyPaid,
      test: result.test,
    };
  }

  return {
    error: "The bill is being updated by someone else. Please try again.",
  };
}

// Convenience: pay the entire remaining balance.
export async function payBillFull(token: string): Promise<PayResult> {
  return payBillAmount(token, null, 0);
}

// ---- Pay for specific items (per-person split) -----------------------------

export type ItemSelection = { billItemId: string; count: number };

class PayConflict extends Error {}

// Pays for chosen UNITS of the bill (e.g. one of two flat whites), so each
// person settles only their own items. `paidQuantity` on each line tracks how
// many units are already settled, so the same unit can never be paid twice —
// two people picking different units at the same time both succeed; two picking
// the same unit, only one wins and the other is asked to refresh.
export async function payBillItems(
  token: string,
  selections: ItemSelection[],
  tipCents = 0,
): Promise<PayResult> {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };

  const clean = selections.filter(
    (s) => s.billItemId && Number.isInteger(s.count) && s.count > 0,
  );
  if (clean.length === 0) return { error: "Select at least one item." };
  const tip = Number.isInteger(tipCents) && tipCents > 0 ? tipCents : 0;

  const provider = getPaymentProvider();

  for (let attempt = 0; attempt < 5; attempt++) {
    const bill = await getOpenBillWithItems(resolved.visit.tableId);
    if (!bill) return { error: "There's no open bill to pay." };

    // Validate every selection against what's still unpaid, and price it.
    let amount = 0;
    for (const sel of clean) {
      const item = bill.items.find((it) => it.id === sel.billItemId);
      if (!item) return { error: "Those items aren't on this bill anymore." };
      if (item.voided || item.comped) {
        return { error: "That item isn't payable — please refresh." };
      }
      const available = item.quantity - item.paidQuantity;
      if (sel.count > available) {
        return {
          error: "Some of those items were just paid — please refresh.",
        };
      }
      amount += item.unitPriceCents * sel.count;
    }
    if (amount <= 0) return { error: "Select at least one item." };

    const remaining = bill.totalCents - bill.amountPaidCents;
    if (amount > remaining) {
      return { error: "This bill was partly paid already — please refresh." };
    }

    const expectedPaid = bill.amountPaidCents;
    const newPaid = expectedPaid + amount;
    const fullyPaid = newPaid >= bill.totalCents;

    // Reserve atomically: bump each line's paidQuantity and the bill balance,
    // each guarded by a compare-and-swap. Any lost race rolls the whole thing
    // back and we retry from a fresh read.
    try {
      await prisma.$transaction(async (tx) => {
        for (const sel of clean) {
          const item = bill.items.find((it) => it.id === sel.billItemId)!;
          const r = await tx.billItem.updateMany({
            where: { id: item.id, paidQuantity: item.paidQuantity },
            data: { paidQuantity: item.paidQuantity + sel.count },
          });
          if (r.count !== 1) throw new PayConflict();
        }
        const rb = await tx.bill.updateMany({
          where: {
            id: bill.id,
            amountPaidCents: expectedPaid,
            status: { in: ["OPEN", "PARTIALLY_PAID"] },
          },
          data: {
            amountPaidCents: newPaid,
            status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
            paidAt: fullyPaid ? new Date() : null,
          },
        });
        if (rb.count !== 1) throw new PayConflict();
      });
    } catch (e) {
      if (e instanceof PayConflict) continue; // lost a race — re-read and retry
      throw e;
    }

    // Reserved. Charge the provider and record the payment.
    const idempotencyKey = `payitems_${bill.id}_${randomBytes(8).toString("hex")}`;
    const result = await provider.createPayment({
      amountCents: amount + tip,
      currency: bill.currency,
      idempotencyKey,
      metadata: { billId: bill.id, tipCents: String(tip), split: "items" },
    });
    await prisma.payment.create({
      data: {
        billId: bill.id,
        amountCents: amount,
        tipCents: tip,
        currency: bill.currency,
        status: result.status,
        provider: provider.name,
        providerRef: result.providerRef,
        idempotencyKey,
        test: result.test,
      },
    });
    if (tip > 0) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { tipCents: { increment: tip } },
      });
    }

    // Prepay: settling the bill releases any orders that were held for payment.
    if (fullyPaid) await releasePaidOrders(bill.id);

    return {
      paid: true,
      amountPaidCents: amount,
      tipCents: tip,
      fullyPaid,
      test: result.test,
    };
  }

  return { error: "The bill is busy right now. Please try again." };
}

// ---- Customer cancel (mistake safeguard) -----------------------------------

// Lets a customer pull back an order they placed by mistake — but ONLY while the
// kitchen hasn't started it (status still SUBMITTED). Removes the order's items
// from the bill and recomputes the total. Once the kitchen taps "Start
// preparing", it can no longer be cancelled from the phone (staff handle it).
export async function cancelCustomerOrder(token: string, orderId: string) {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };

  const order = await prisma.order.findFirst({
    where: { id: orderId, tableId: resolved.visit.tableId },
  });
  if (!order) return { error: "Order not found." };
  if (order.status !== "SUBMITTED" && order.status !== "PENDING") {
    return { error: "This order is already being prepared and can't be cancelled here." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.billItem.deleteMany({ where: { orderId: order.id } });
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
    await recompute(tx, order.billId);
  });

  return { ok: true as const };
}

// Saves a customer's mobile on the open bill so they get an "order ready" SMS.
export async function setBillContact(token: string, phone: string) {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };
  const e164 = normalizeAuPhone(phone);
  if (!e164) return { error: "Enter a valid mobile number." };
  const bill = await getOpenBillWithItems(resolved.visit.tableId);
  if (!bill) return { error: "There's no open bill yet." };
  await prisma.bill.update({
    where: { id: bill.id },
    data: { customerPhone: e164 },
  });
  return { ok: true as const };
}

// ---- Order history (staff / kitchen) ---------------------------------------

// How far back the kitchen history view reaches. A week covers "did table 4
// already have this?" without loading the whole trading record.
export const HISTORY_DAYS = 7;

export async function getRecentOrders(
  restaurantId: string,
  days = HISTORY_DAYS,
) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      bill: { include: { table: true } },
    },
  });
}

// ---- Bump / recall ---------------------------------------------------------

// Orders served in the last `minutes`, so the kitchen can recall one bumped by
// mistake.
export async function getRecentlyServed(restaurantId: string, minutes = 20) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return prisma.order.findMany({
    where: { restaurantId, status: "SERVED", servedAt: { gte: cutoff } },
    orderBy: { servedAt: "desc" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      bill: { include: { table: true } },
    },
  });
}

// Bring a served ticket back to the board.
export async function recallOrder(orderId: string, restaurantId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId, status: "SERVED" },
  });
  if (!order) return { error: "That ticket can't be recalled." };
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PREPARING", servedAt: null },
  });
  return { ok: true as const };
}

// ---- Staff bill adjustments (void / comp / discount) -----------------------

async function ownedOpenBillItem(itemId: string, restaurantId: string) {
  return prisma.billItem.findFirst({
    where: { id: itemId, bill: { table: { location: { restaurantId } } } },
    include: { bill: { select: { id: true, status: true } } },
  });
}

export async function voidBillItem(
  itemId: string,
  restaurantId: string,
  voided = true,
) {
  const item = await ownedOpenBillItem(itemId, restaurantId);
  if (!item) return { error: "Item not found." };
  if (item.bill.status === "PAID") return { error: "This bill is already paid." };
  await prisma.$transaction(async (tx) => {
    await tx.billItem.update({ where: { id: item.id }, data: { voided } });
    await recompute(tx, item.billId);
  });
  return { ok: true as const };
}

export async function compBillItem(
  itemId: string,
  restaurantId: string,
  comped = true,
) {
  const item = await ownedOpenBillItem(itemId, restaurantId);
  if (!item) return { error: "Item not found." };
  if (item.bill.status === "PAID") return { error: "This bill is already paid." };
  await prisma.$transaction(async (tx) => {
    await tx.billItem.update({ where: { id: item.id }, data: { comped } });
    await recompute(tx, item.billId);
  });
  return { ok: true as const };
}

export async function setBillDiscount(
  billId: string,
  restaurantId: string,
  discountCents: number,
) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, table: { location: { restaurantId } } },
  });
  if (!bill) return { error: "Bill not found." };
  if (bill.status === "PAID") return { error: "This bill is already paid." };
  const d = Number.isInteger(discountCents) && discountCents > 0 ? discountCents : 0;
  await prisma.$transaction(async (tx) => {
    await tx.bill.update({ where: { id: bill.id }, data: { discountCents: d } });
    await recompute(tx, bill.id);
  });
  return { ok: true as const };
}

// Settle a specific bill in full (used for pickup orders paid at the counter),
// scoped to the staff member's restaurant.
export async function staffCloseBillById(billId: string, restaurantId: string) {
  const provider = getPaymentProvider();
  for (let attempt = 0; attempt < 5; attempt++) {
    const bill = await prisma.bill.findFirst({
      where: {
        id: billId,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
        table: { location: { restaurantId } },
      },
    });
    if (!bill) return { error: "No open bill to close." };
    const remaining = bill.totalCents - bill.amountPaidCents;
    if (remaining <= 0) return { paid: true as const };

    const cas = await prisma.bill.updateMany({
      where: {
        id: bill.id,
        amountPaidCents: bill.amountPaidCents,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
      data: { amountPaidCents: bill.totalCents, status: "PAID", paidAt: new Date() },
    });
    if (cas.count !== 1) continue;

    const idempotencyKey = `staffpay_${bill.id}_${randomBytes(8).toString("hex")}`;
    const result = await provider.createPayment({
      amountCents: remaining,
      currency: bill.currency,
      idempotencyKey,
      metadata: { billId: bill.id, source: "staff" },
    });
    await prisma.payment.create({
      data: {
        billId: bill.id,
        amountCents: remaining,
        currency: bill.currency,
        status: result.status,
        provider: "counter",
        providerRef: result.providerRef,
        idempotencyKey,
        test: result.test,
      },
    });
    await releasePaidOrders(bill.id);
    return { paid: true as const };
  }
  return { error: "The bill is busy. Please try again." };
}

// ---- Takeaway / pickup orders ----------------------------------------------

// Places a pickup order not tied to a table sitting: each pickup is its own
// bill on the location's takeaway pseudo-table, with a pickup (order) number.
export async function createTakeawayOrder(
  slug: string,
  customerName: string,
  items: AddItem[],
  note?: string,
  clientRequestId?: string,
  customerPhone?: string,
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: { locations: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!restaurant || !restaurant.takeawayEnabled) {
    return { error: "Pickup ordering isn't available here." };
  }
  const location = restaurant.locations[0];
  if (!location) return { error: "Pickup ordering isn't set up yet." };

  const name = (customerName ?? "").trim().slice(0, 60);
  if (name.length < 1) return { error: "Please enter your name." };

  const lines = items.filter(
    (i) => i.menuItemId && Number.isInteger(i.quantity) && i.quantity > 0,
  );
  if (lines.length === 0) return { error: "Nothing to add." };
  const cleanNote = note?.trim().slice(0, 200) || null;
  const idemKey = clientRequestId?.trim() || null;

  if (idemKey) {
    const existing = await prisma.order.findUnique({
      where: { clientRequestId: idemKey },
    });
    if (existing) {
      return { ok: true as const, orderNumber: existing.orderNumber };
    }
  }

  // The location's takeaway pseudo-table (created on first pickup order).
  let table = await prisma.table.findFirst({
    where: { locationId: location.id, isTakeaway: true },
  });
  if (!table) {
    table = await prisma.table.create({
      data: { locationId: location.id, label: "Pickup", isTakeaway: true },
    });
  }
  const takeawayTable = table;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.create({
        data: {
          tableId: takeawayTable.id,
          currency: restaurant.currency,
          isTakeaway: true,
          customerName: name,
          customerPhone: normalizeAuPhone(customerPhone ?? "") ?? undefined,
        },
      });
      const rest = await tx.restaurant.update({
        where: { id: restaurant.id },
        data: { orderSeq: { increment: 1 } },
        select: { orderSeq: true, staffApproval: true, paymentTiming: true },
      });
      const awaitingApproval = rest.staffApproval;
      const awaitingPayment = rest.paymentTiming === "before";
      const held = awaitingApproval || awaitingPayment;

      const order = await tx.order.create({
        data: {
          billId: bill.id,
          tableId: takeawayTable.id,
          restaurantId: restaurant.id,
          source: "CUSTOMER",
          note: cleanNote,
          clientRequestId: idemKey,
          orderNumber: rest.orderSeq,
          status: held ? "PENDING" : "SUBMITTED",
          awaitingApproval,
          awaitingPayment,
        },
      });

      let added = 0;
      for (const line of lines) {
        const item = await tx.menuItem.findFirst({
          where: {
            id: line.menuItemId,
            available: true,
            category: { restaurantId: restaurant.id },
          },
          include: {
            category: { select: { station: true } },
            modifierGroups: { include: { options: true } },
          },
        });
        if (!item) continue;
        const resolved = resolveModifiers(item, line.optionIds ?? []);
        if ("error" in resolved) throw new LineError(resolved.error);
        const qty = Math.min(line.quantity, 99);
        await tx.billItem.create({
          data: {
            billId: bill.id,
            orderId: order.id,
            menuItemId: item.id,
            nameSnapshot: item.name,
            unitPriceCents: resolved.unitPriceCents,
            modifiers: resolved.modifiers.length
              ? (resolved.modifiers as object[])
              : undefined,
            quantity: qty,
            lineTotalCents: resolved.unitPriceCents * qty,
            station: item.category?.station ?? null,
          },
        });
        added++;
      }
      if (added === 0) throw new EmptySend();
      await recompute(tx, bill.id);
      return { orderNumber: rest.orderSeq };
    });
    return { ok: true as const, orderNumber: result.orderNumber };
  } catch (e) {
    if (e instanceof LineError) return { error: e.reason };
    if (e instanceof EmptySend) return { error: "Those items aren't available." };
    if (isUniqueViolation(e) && uniqueTargetIncludes(e, "clientRequestId")) {
      return { ok: true as const };
    }
    throw e;
  }
}

// ---- Menu availability (shared) --------------------------------------------

// Toggles a menu item's availability, scoped to a restaurant so a staff member
// can only ever affect their own venue's menu. Used by the staff sold-out view.
export async function setMenuItemAvailable(
  itemId: string,
  restaurantId: string,
  available: boolean,
) {
  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, category: { restaurantId } },
  });
  if (!item) return { error: "Item not found." };
  await prisma.menuItem.update({ where: { id: item.id }, data: { available } });
  return { ok: true as const };
}

// ---- Staff-recorded payment (counter / cash) -------------------------------

// Closes a table's open bill by recording payment for the full remaining
// balance — used when a customer pays at the counter or a waiter takes payment
// (i.e. self-serve payment is off). Same concurrency-safe compare-and-swap as
// the customer pay flow, scoped to the staff member's restaurant.
export async function staffCloseBill(tableId: string, restaurantId: string) {
  const provider = getPaymentProvider();

  for (let attempt = 0; attempt < 5; attempt++) {
    const bill = await prisma.bill.findFirst({
      where: {
        tableId,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
        table: { location: { restaurantId } },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!bill) return { error: "No open bill on this table." };

    const remaining = bill.totalCents - bill.amountPaidCents;
    if (remaining <= 0) return { paid: true as const };

    const expectedPaid = bill.amountPaidCents;
    const cas = await prisma.bill.updateMany({
      where: {
        id: bill.id,
        amountPaidCents: expectedPaid,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
      data: {
        amountPaidCents: bill.totalCents,
        status: "PAID",
        paidAt: new Date(),
      },
    });
    if (cas.count !== 1) continue; // lost the race — re-read and retry

    const idempotencyKey = `staffpay_${bill.id}_${randomBytes(8).toString("hex")}`;
    const result = await provider.createPayment({
      amountCents: remaining,
      currency: bill.currency,
      idempotencyKey,
      metadata: { billId: bill.id, source: "staff" },
    });
    await prisma.payment.create({
      data: {
        billId: bill.id,
        amountCents: remaining,
        currency: bill.currency,
        status: result.status,
        provider: "counter",
        providerRef: result.providerRef,
        idempotencyKey,
        test: result.test,
      },
    });
    // Prepay: staff taking payment also releases any payment-held orders.
    await releasePaidOrders(bill.id);
    return { paid: true as const };
  }
  return { error: "The bill is busy. Please try again." };
}
