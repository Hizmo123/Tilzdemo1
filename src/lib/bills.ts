import { randomBytes, randomUUID } from "crypto";
import { Prisma, type TenderType, type BillStatus, type PaymentStatus, type RefundStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { notifyRestaurant } from "@/lib/realtime";
import { formatCents } from "@/lib/money";
import { log } from "@/lib/log";
import { entitlementsForTier } from "@/lib/entitlements";
import { getVenuePaymentContext } from "@/lib/square/context";
import { chargeBillViaSquare, refundViaSquare, type SquareChargeLineItem } from "@/lib/square/pay";

// ---- Visit resolution -------------------------------------------------------

export type VisitInvalid =
  | "not_found"
  | "code_revoked"
  | "table_inactive"
  | "not_published";

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
  cornerStyle: string;
  tagline: string | null;
  menuLayout: string;
  instagramHandle: string | null;
  websiteUrl: string | null;
  tipEnabled: boolean;
  tipPresets: number[];
  customerOrdering: boolean;
  customerPayment: boolean;
  staffApproval: boolean;
  paymentTiming: string;
  // Opt-in strict variant of paymentTiming "before": that mode holds the
  // order and *offers* payment as the primary next step; this one means the
  // customer page never presents the placed order as a soft "you're free to
  // skip payment" moment — see requirePaymentBeforeOrder's schema comment.
  requirePaymentBeforeOrder: boolean;
  splitMethods: string[];
  surchargeEnabled: boolean;
  surchargeBasisPoints: number;
  // Plan entitlements (see lib/entitlements.ts), resolved here so the
  // customer page and its actions don't need a second round trip for them.
  showTillzBranding: boolean;
  orderingBlocked: boolean;
  // Deep customisation (A5) — see lib/menu-style.ts for how these resolve.
  cardStyle: unknown;
  typeScale: string;
  sectionHeaderStyle: string;
  buttonShape: string;
  buttonFill: string;
  bgTreatment: string;
  bgPatternKey: string | null;
  bgOverlayStrength: number;
  qrForegroundColor: string | null;
  qrBackgroundColor: string | null;
  qrCornerStyle: string;
  qrEmbedLogo: boolean;
  // Whether this venue's card payments go through Square (Phase 3) or the
  // mock provider — see getVenuePaymentContext. Only public, non-secret
  // values reach the client: the app id and location id are meant to be
  // embedded in a browser page (that's how Square's Web Payments SDK is
  // designed to work), never the OAuth access token or app secret.
  squareEnabled: boolean;
  squareAppId: string | null;
  squareLocationId: string | null;
  squareEnv: string | null;
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
      table: {
        include: {
          location: {
            include: {
              restaurant: {
                include: {
                  organization: { select: { plan: true, subscriptionLapsedAt: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!qr) return { ok: false, reason: "not_found" };
  if (!qr.active) return { ok: false, reason: "code_revoked" };
  if (!qr.table.active) return { ok: false, reason: "table_inactive" };
  if (!qr.table.location.restaurant.published) return { ok: false, reason: "not_published" };

  const r = qr.table.location.restaurant;
  const ent = entitlementsForTier(r.organization.plan, {
    lapsedAt: r.organization.subscriptionLapsedAt,
  });
  const paymentContext = await getVenuePaymentContext(r.id);
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
      cornerStyle: r.cornerStyle,
      tagline: r.tagline,
      menuLayout: r.menuLayout,
      instagramHandle: r.instagramHandle,
      websiteUrl: r.websiteUrl,
      tipEnabled: r.tipEnabled,
      tipPresets: r.tipPresets,
      customerOrdering: r.customerOrdering,
      customerPayment: r.customerPayment,
      staffApproval: r.staffApproval,
      paymentTiming: r.paymentTiming,
      requirePaymentBeforeOrder: r.requirePaymentBeforeOrder,
      splitMethods: r.splitMethods,
      surchargeEnabled: r.surchargeEnabled,
      surchargeBasisPoints: r.surchargeBasisPoints,
      showTillzBranding: ent.showTillzBranding,
      orderingBlocked: ent.orderingBlocked,
      cardStyle: r.cardStyle,
      typeScale: r.typeScale,
      sectionHeaderStyle: r.sectionHeaderStyle,
      buttonShape: r.buttonShape,
      buttonFill: r.buttonFill,
      bgTreatment: r.bgTreatment,
      bgPatternKey: r.bgPatternKey,
      bgOverlayStrength: r.bgOverlayStrength,
      qrForegroundColor: r.qrForegroundColor,
      qrBackgroundColor: r.qrBackgroundColor,
      qrCornerStyle: r.qrCornerStyle,
      qrEmbedLogo: r.qrEmbedLogo,
      squareEnabled: paymentContext.mode === "square",
      squareAppId: paymentContext.mode === "square" ? paymentContext.squareAppId : null,
      squareLocationId: paymentContext.mode === "square" ? paymentContext.squareLocationId : null,
      squareEnv: paymentContext.mode === "square" ? paymentContext.squareEnv : null,
    },
  };
}

// A card surcharge is disclosed to the customer before they confirm (client
// shows this same calculation as a preview), but the amount actually charged
// is always recomputed here from the restaurant's stored rate — the client's
// number is never trusted for the charge itself.
export function surchargeFor(baseCents: number, basisPoints: number): number {
  if (basisPoints <= 0 || baseCents <= 0) return 0;
  return Math.round((baseCents * basisPoints) / 10000);
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

// Same as above plus this bill's live orders (for the customer page's "your
// orders" status list) in the SAME round trip — that list used to be a
// separate sequential query fired only after this one resolved, which on a
// database that isn't co-located with the app server (see the region note in
// the A2 performance report) is a full extra network hop of pure latency on
// every single customer page load, for data this call can return for free.
export async function getOpenBillWithOrders(tableId: string) {
  return prisma.bill.findFirst({
    where: { tableId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
    orderBy: { createdAt: "desc" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "asc" },
        include: { items: { select: { nameSnapshot: true, quantity: true } } },
      },
    },
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
  // Free text for this specific line, e.g. "no fries" — separate from the
  // whole-send note (see addItemsForTable's own `note` param).
  note?: string;
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
  // Lapsed-subscription grace period (spec B4): existing service, viewing
  // and paying an already-open bill all keep working — this is the ONE place
  // new ordering actually stops, and only once the grace period has passed.
  if (resolved.visit.orderingBlocked) {
    return { error: "This venue can't take new orders right now. Please ask a staff member." };
  }
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

// Shared core: creates one order ticket + its priced bill items against an
// ALREADY-RESOLVED bill (table order or counter sale alike — the caller has
// already found-or-created the bill and decided its tableId). Split out of
// addItemsForTable so a counter sale (addItemsToCounterBill) can drive the
// exact same pricing/modifier/order-number logic against a billId directly,
// with no table and no "find or create by tableId" race to handle. Must run
// inside the caller's transaction (so a partial write always rolls back with
// the rest of the send) and throws LineError/EmptySend on failure, same as
// before this was extracted.
async function createOrderWithItems(
  tx: Prisma.TransactionClient,
  args: {
    billId: string;
    tableId: string | null;
    restaurantId: string;
    lines: AddItem[];
    source: "CUSTOMER" | "STAFF";
    cleanNote: string | null;
    idemKey: string | null;
  },
): Promise<{ orderId: string; added: number }> {
  const { billId, tableId, restaurantId, lines, source, cleanNote, idemKey } = args;

  // Allocate a human order number (atomic per-venue counter) and read the
  // service settings in the same row update.
  const rest = await tx.restaurant.update({
    where: { id: restaurantId },
    data: { orderSeq: { increment: 1 } },
    select: {
      orderSeq: true,
      staffApproval: true,
      paymentTiming: true,
      requirePaymentBeforeOrder: true,
    },
  });
  // Release gates for CUSTOMER orders (a waiter's own order — and a counter
  // sale, always STAFF — is never held):
  //  - approval: staff must accept before the kitchen sees it.
  //  - payment: prepay venue (paymentTiming "before"), or the stricter
  //    opt-in requirePaymentBeforeOrder — either way the kitchen never
  //    sees it until it's paid. The two are independent switches: a
  //    venue can have "before" without the strict variant (today's
  //    behaviour, unchanged) or turn on the strict variant on top of it
  //    for a harder "no submitting without paying" customer flow.
  const awaitingApproval = source === "CUSTOMER" && rest.staffApproval;
  const awaitingPayment =
    source === "CUSTOMER" &&
    (rest.paymentTiming === "before" || rest.requirePaymentBeforeOrder);
  const held = awaitingApproval || awaitingPayment;

  // One order ticket per send.
  const order = await tx.order.create({
    data: {
      billId,
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

  // One batched lookup for every distinct item in the cart instead of a
  // findFirst-then-create round trip per line — a 6-item order used to
  // be 12+ sequential DB round trips inside this transaction (at this
  // project's ~150-250ms per round trip, several real seconds), which
  // is exactly the kind of delay that tripped the client's "couldn't
  // send, retrying" fallback on a perfectly working connection.
  const uniqueIds = [...new Set(lines.map((l) => l.menuItemId))];
  const foundItems = await tx.menuItem.findMany({
    where: {
      id: { in: uniqueIds },
      available: true,
      category: { restaurantId },
    },
    include: {
      category: { select: { station: true } },
      modifierGroups: { include: { options: true } },
    },
  });
  const itemById = new Map(foundItems.map((it) => [it.id, it]));

  const billItemRows: {
    id: string;
    billId: string;
    orderId: string;
    menuItemId: string;
    nameSnapshot: string;
    unitPriceCents: number;
    modifiers: object[] | undefined;
    quantity: number;
    lineTotalCents: number;
    station: string | null;
    note: string | null;
  }[] = [];

  for (const line of lines) {
    const item = itemById.get(line.menuItemId);
    if (!item) continue; // silently skip unavailable/foreign items

    const resolved = resolveModifiers(item, line.optionIds ?? []);
    if ("error" in resolved) throw new LineError(resolved.error); // rolls back the whole send

    const qty = Math.min(line.quantity, 99);

    billItemRows.push({
      id: randomUUID(),
      billId,
      orderId: order.id,
      menuItemId: item.id,
      nameSnapshot: item.name,
      unitPriceCents: resolved.unitPriceCents,
      modifiers: resolved.modifiers.length
        ? (resolved.modifiers as object[])
        : undefined,
      quantity: qty,
      lineTotalCents: resolved.unitPriceCents * qty,
      station: item.station ?? item.category?.station ?? null,
      note: line.note?.trim().slice(0, 140) || null,
    });
  }

  if (billItemRows.length) {
    await tx.billItem.createMany({ data: billItemRows });
  }
  const added = billItemRows.length;

  // Nothing landed — throw so the order (and a just-created bill) roll
  // back rather than leaving an empty ticket behind.
  if (added === 0) throw new EmptySend();

  await recompute(tx, billId);
  return { orderId: order.id, added };
}

// Adds menu items to a table's open bill, priced from the DB. Used by both
// the customer flow (resolved from a QR token) and staff taking an order at
// the table (resolved from a staff session). The caller must have already
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
    let orderIdForLog = "";
    let addedForLog = 0;
    try {
      await prisma.$transaction(async (tx) => {
        // Find-or-create the single open bill for this table.
        let bill = await tx.bill.findFirst({
          where: { tableId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
          orderBy: { createdAt: "desc" },
        });
        if (!bill) {
          // A new dine-in bill sets restaurantId/locationId directly too
          // (not just tableId) — analytics/invoices now scope revenue via
          // these columns (see lib/analytics.ts, lib/invoices.ts), so every
          // bill created from here on needs them populated, not just
          // counter bills.
          const table = await tx.table.findUniqueOrThrow({
            where: { id: tableId },
            select: { locationId: true },
          });
          bill = await tx.bill.create({
            data: {
              tableId,
              currency,
              restaurantId,
              locationId: table.locationId,
              channel: "DINE_IN",
            },
          });
        }

        const result = await createOrderWithItems(tx, {
          billId: bill.id,
          tableId,
          restaurantId,
          lines,
          source,
          cleanNote,
          idemKey,
        });
        orderIdForLog = result.orderId;
        addedForLog = result.added;
      });

      await notifyRestaurant(restaurantId);
      log.info("order.created", {
        restaurantId,
        tableId,
        orderId: orderIdForLog,
        source,
        lineCount: addedForLog,
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
      log.error("order.create_failed", {
        restaurantId,
        tableId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  log.warn("order.create_contended", { restaurantId, tableId });
  return { error: "This table is busy right now. Please try again." };
}

// ---- Counter (cashier) sales -------------------------------------------------

// Starts a new counter tab — never reused, unlike a table's bill (which is
// find-or-create). Counter sales are independent and unlimited: staff can
// have several open at once (e.g. multiple registers, or one customer
// waiting on a drink while another is rung up), so this always creates a
// fresh Bill rather than looking for an existing open one.
export async function createCounterBill(
  restaurantId: string,
  locationId: string,
): Promise<{ ok: true; billId: string } | { error: string }> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { currency: true },
  });
  if (!restaurant) return { error: "Restaurant not found." };

  const location = await prisma.location.findFirst({
    where: { id: locationId, restaurantId },
  });
  if (!location) return { error: "Location not found." };

  const bill = await prisma.bill.create({
    data: {
      tableId: null,
      restaurantId,
      locationId,
      channel: "COUNTER",
      currency: restaurant.currency,
    },
  });

  return { ok: true, billId: bill.id };
}

// Adds items to an existing counter bill. Reuses the exact same pricing/
// modifier/order-number core addItemsForTable uses (createOrderWithItems) —
// no duplicated logic. Always source "STAFF" (a counter sale is never
// customer-initiated) and tableId null throughout.
export async function addItemsToCounterBill(
  billId: string,
  restaurantId: string,
  items: AddItem[],
  note?: string,
) {
  const cleanNote = note?.trim().slice(0, 200) || null;

  const lines = items.filter(
    (i) => i.menuItemId && Number.isInteger(i.quantity) && i.quantity > 0,
  );
  if (lines.length === 0) return { error: "Nothing to add." };

  try {
    let orderIdForLog = "";
    let addedForLog = 0;
    await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({
        where: {
          id: billId,
          restaurantId,
          channel: "COUNTER",
          status: { in: ["OPEN", "PARTIALLY_PAID"] },
        },
      });
      if (!bill) throw new LineError("This sale is no longer open.");

      const result = await createOrderWithItems(tx, {
        billId: bill.id,
        tableId: null,
        restaurantId,
        lines,
        source: "STAFF",
        cleanNote,
        idemKey: null,
      });
      orderIdForLog = result.orderId;
      addedForLog = result.added;
    });

    await notifyRestaurant(restaurantId);
    log.info("order.created", {
      restaurantId,
      billId,
      orderId: orderIdForLog,
      source: "STAFF",
      lineCount: addedForLog,
    });
    return { ok: true as const };
  } catch (e) {
    if (e instanceof LineError) return { error: e.reason };
    if (e instanceof EmptySend) return { error: "Those items aren't available." };
    log.error("order.create_failed", {
      restaurantId,
      billId,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

// Open counter bill + its items/orders, scoped to restaurantId — the counter
// sale screen's main read.
export async function getCounterBillWithOrders(billId: string, restaurantId: string) {
  return prisma.bill.findFirst({
    where: { id: billId, restaurantId, channel: "COUNTER" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "asc" },
        include: { items: { select: { nameSnapshot: true, quantity: true } } },
      },
    },
  });
}

// All open counter sales for the restaurant, newest first — the counter
// landing screen's list.
export async function listOpenCounterBills(restaurantId: string) {
  const bills = await prisma.bill.findMany({
    where: {
      restaurantId,
      channel: "COUNTER",
      status: { in: ["OPEN", "PARTIALLY_PAID"] },
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return bills.map((b) => ({
    id: b.id,
    status: b.status,
    itemCount: b._count.items,
    totalCents: b.totalCents,
    amountPaidCents: b.amountPaidCents,
    createdAt: b.createdAt,
  }));
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

  await notifyRestaurant(restaurantId);
  return { ok: true as const };
}

// Active kitchen tickets for a restaurant (not yet served or cancelled).
// Joins each line's current menu item for allergens and 86-ability — a live
// join, not a snapshot, since allergen warnings need to reflect today's menu
// data, not whatever it was when the line was ordered (unlike price/name,
// which are deliberately frozen).
export async function getKitchenOrders(restaurantId: string) {
  return prisma.order.findMany({
    where: {
      restaurantId,
      status: { in: ["SUBMITTED", "PREPARING", "READY"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: { menuItem: { select: { allergens: true, available: true } } },
      },
      bill: { include: { table: true } },
    },
  });
}

// Orders the kitchen has marked READY but no one's marked SERVED yet — the
// waiter-facing "go pick these up" queue (see the staff home page's
// ReadyBanner, which buzzes/chimes when a new one appears here).
export async function getReadyOrders(restaurantId: string) {
  return prisma.order.findMany({
    where: { restaurantId, status: "READY" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      bill: { select: { table: { select: { label: true } } } },
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
  await notifyRestaurant(restaurantId);
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
  await notifyRestaurant(restaurantId);
  return { ok: true as const };
}

// ---- Pay --------------------------------------------------------------------

export type PayResult =
  | {
      paid: true;
      amountPaidCents: number;
      tipCents: number;
      surchargeCents: number;
      fullyPaid: boolean;
      test: boolean;
    }
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
// Undoes an amountPaidCents CAS reserve that a Square charge failed to
// honour, so the bill is never left falsely part-paid. Guarded by its own
// CAS (only succeeds if the balance is still exactly what the reserve set
// it to) rather than a blind write — nothing else can have legitimately
// moved it in between (the reserve already claimed the balance), but this
// keeps the release itself just as safe as the reserve was.
async function releaseBillReserve(
  billId: string,
  reservedPaid: number,
  previousPaid: number,
  previousStatus: BillStatus,
  previousPaidAt: Date | null,
) {
  await prisma.bill.updateMany({
    where: { id: billId, amountPaidCents: reservedPaid },
    data: { amountPaidCents: previousPaid, status: previousStatus, paidAt: previousPaidAt },
  });
}

export async function payBillAmount(
  token: string,
  requestedCents: number | null,
  tipCents = 0,
  mode: "full" | "equal" | "custom" = "full",
  // Web Payments SDK card token (Phase 3) — required when the venue is
  // Square-connected (visit.squareEnabled); ignored on mock venues.
  sourceId?: string,
): Promise<PayResult> {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };

  // The client never gets the final say on which split method is used — a
  // hidden tab is presentation only, so it's re-checked here.
  if (!resolved.visit.splitMethods.includes(mode)) {
    return { error: "This payment option isn't available for this venue." };
  }

  if (
    requestedCents !== null &&
    (!Number.isInteger(requestedCents) || requestedCents <= 0)
  ) {
    return { error: "Enter a valid amount." };
  }
  // Belt and braces: "custom" must always name a positive amount. null means
  // "pay the full remaining balance" everywhere else in this function, but
  // that meaning must never be reachable through the custom-amount path —
  // the client already blocks this before calling here (see pay-sheet.tsx),
  // this is the server-side backstop in case that ever changes.
  if (mode === "custom" && (requestedCents === null || requestedCents <= 0)) {
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
      return {
        paid: true,
        amountPaidCents: 0,
        tipCents: 0,
        surchargeCents: 0,
        fullyPaid: true,
        test: provider.isTest,
      };
    }

    // Clamp to the outstanding balance — never charge more than is owed.
    const amount = Math.min(requestedCents ?? remaining, remaining);
    if (amount <= 0) return { error: "Enter a valid amount." };

    // Surcharge is on the amount actually charged to the card (goods share
    // being settled now, plus any tip) — recomputed here from the venue's
    // stored rate, never trusted from the client that showed the preview.
    const surcharge = resolved.visit.surchargeEnabled
      ? surchargeFor(amount + tip, resolved.visit.surchargeBasisPoints)
      : 0;

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

    // Balance reserved. Charge (mock provider, or Square for a connected
    // venue) and record the payment. Any Square failure from here on MUST
    // release the reserve before returning — the balance was already bumped
    // above, so a bill left here without either a successful charge or a
    // release would be falsely part-paid.
    const idempotencyKey = `pay_${bill.id}_${randomBytes(8).toString("hex")}`;
    const paymentContext = await getVenuePaymentContext(resolved.visit.restaurantId);

    let paymentRow: {
      status: "PENDING" | "SUCCEEDED" | "FAILED";
      provider: string;
      providerRef: string | undefined;
      squareOrderId: string | null;
      test: boolean;
    };

    if (paymentContext.mode === "square") {
      if (!sourceId) {
        await releaseBillReserve(bill.id, newPaid, expectedPaid, bill.status, bill.paidAt);
        return { error: "Card details are required." };
      }
      const connection = await prisma.squareConnection.findUnique({
        where: { restaurantId: resolved.visit.restaurantId },
      });
      if (!connection) {
        await releaseBillReserve(bill.id, newPaid, expectedPaid, bill.status, bill.paidAt);
        return { error: "This venue's card payment isn't available right now." };
      }
      // No set of specific bill items sums to an arbitrary full/equal/custom
      // amount once partial item-split payments are mixed in, so this is
      // always a single ad-hoc line for the amount actually being charged —
      // see the note on ChargeBillViaSquareInput.lineItems for why that's the
      // only choice that keeps the order total guaranteed exact.
      const lineItems: SquareChargeLineItem[] = [
        { name: `Bill payment (${mode})`, quantity: 1, unitPriceCents: amount },
      ];
      try {
        const result = await chargeBillViaSquare({
          connection,
          bill: { id: bill.id, tableLabel: resolved.visit.tableLabel },
          lineItems,
          goodsCents: amount,
          tipCents: tip,
          surchargeCents: surcharge,
          currency: bill.currency,
          sourceId,
          idempotencyKey,
        });
        paymentRow = {
          status: result.status,
          provider: "square",
          providerRef: result.providerRef,
          squareOrderId: result.squareOrderId,
          test: paymentContext.squareEnv !== "production",
        };
      } catch (e) {
        await releaseBillReserve(bill.id, newPaid, expectedPaid, bill.status, bill.paidAt);
        const detail = e instanceof Error ? e.message : String(e);
        console.error("square.pay_bill_amount_failed", { billId: bill.id, error: detail });
        log.warn("payment.square_failed", {
          restaurantId: resolved.visit.restaurantId,
          billId: bill.id,
          error: detail,
        });
        // The detailed Square error (already formatted as category/code:
        // detail by chargeBillViaSquare) reaches the client verbatim, not a
        // generic message — this is what's actually shown in the pay sheet,
        // and what needs to be visible to diagnose a real failure.
        return { error: detail };
      }
    } else {
      const result = await provider.createPayment({
        amountCents: amount + tip + surcharge,
        currency: bill.currency,
        idempotencyKey,
        metadata: { billId: bill.id, tipCents: String(tip), surchargeCents: String(surcharge) },
      });
      paymentRow = {
        status: result.status,
        provider: provider.name,
        providerRef: result.providerRef,
        squareOrderId: null,
        test: result.test,
      };
    }

    await prisma.payment.create({
      data: {
        billId: bill.id,
        amountCents: amount,
        tipCents: tip,
        surchargeCents: surcharge,
        currency: bill.currency,
        status: paymentRow.status,
        provider: paymentRow.provider,
        providerRef: paymentRow.providerRef,
        squareOrderId: paymentRow.squareOrderId,
        idempotencyKey,
        test: paymentRow.test,
      },
    });
    if (paymentRow.squareOrderId) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { squareOrderId: paymentRow.squareOrderId },
      });
    }

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

    await notifyRestaurant(resolved.visit.restaurantId);
    log.info("payment.succeeded", {
      restaurantId: resolved.visit.restaurantId,
      billId: bill.id,
      amountCents: amount,
      tipCents: tip,
      surchargeCents: surcharge,
      provider: paymentRow.provider,
      status: paymentRow.status,
      test: paymentRow.test,
    });
    return {
      paid: true,
      amountPaidCents: amount,
      tipCents: tip,
      surchargeCents: surcharge,
      fullyPaid,
      test: paymentRow.test,
    };
  }

  log.warn("payment.contended", { restaurantId: resolved.visit.restaurantId, billId: null });
  return {
    error: "The bill is being updated by someone else. Please try again.",
  };
}

// Convenience: pay the entire remaining balance.
export async function payBillFull(token: string, sourceId?: string): Promise<PayResult> {
  return payBillAmount(token, null, 0, "full", sourceId);
}

// ---- Pay for specific items (per-person split) -----------------------------

export type ItemSelection = { billItemId: string; count: number };

class PayConflict extends Error {}

// Same idea as releaseBillReserve, but also undoes the per-line paidQuantity
// bumps payBillItems' reserve makes — both are rolled back together, inside
// one transaction, so a failed Square charge never leaves some units marked
// paid without a successful payment behind them.
async function releaseItemsReserve(
  billId: string,
  reservations: { billItemId: string; previousPaidQuantity: number; newPaidQuantity: number }[],
  reservedPaid: number,
  previousPaid: number,
  previousStatus: BillStatus,
  previousPaidAt: Date | null,
) {
  await prisma.$transaction(async (tx) => {
    for (const r of reservations) {
      await tx.billItem.updateMany({
        where: { id: r.billItemId, paidQuantity: r.newPaidQuantity },
        data: { paidQuantity: r.previousPaidQuantity },
      });
    }
    await tx.bill.updateMany({
      where: { id: billId, amountPaidCents: reservedPaid },
      data: { amountPaidCents: previousPaid, status: previousStatus, paidAt: previousPaidAt },
    });
  });
}

// Pays for chosen UNITS of the bill (e.g. one of two flat whites), so each
// person settles only their own items. `paidQuantity` on each line tracks how
// many units are already settled, so the same unit can never be paid twice —
// two people picking different units at the same time both succeed; two picking
// the same unit, only one wins and the other is asked to refresh.
export async function payBillItems(
  token: string,
  selections: ItemSelection[],
  tipCents = 0,
  // Web Payments SDK card token (Phase 3) — required when the venue is
  // Square-connected (visit.squareEnabled); ignored on mock venues.
  sourceId?: string,
): Promise<PayResult> {
  const resolved = await resolveVisit(token);
  if (!resolved.ok) return { error: "This table is no longer available." };

  if (!resolved.visit.splitMethods.includes("items")) {
    return { error: "This payment option isn't available for this venue." };
  }

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

    const surcharge = resolved.visit.surchargeEnabled
      ? surchargeFor(amount + tip, resolved.visit.surchargeBasisPoints)
      : 0;

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

    // Reserved. Charge (mock, or Square for a connected venue) and record
    // the payment. Any Square failure MUST release both the item paidQuantity
    // bumps and the bill balance CAS above before returning.
    const idempotencyKey = `payitems_${bill.id}_${randomBytes(8).toString("hex")}`;
    const paymentContext = await getVenuePaymentContext(resolved.visit.restaurantId);

    const reservations = clean.map((sel) => {
      const item = bill.items.find((it) => it.id === sel.billItemId)!;
      return {
        billItemId: item.id,
        previousPaidQuantity: item.paidQuantity,
        newPaidQuantity: item.paidQuantity + sel.count,
      };
    });

    let paymentRow: {
      status: "PENDING" | "SUCCEEDED" | "FAILED";
      provider: string;
      providerRef: string | undefined;
      squareOrderId: string | null;
      test: boolean;
    };

    if (paymentContext.mode === "square") {
      if (!sourceId) {
        await releaseItemsReserve(bill.id, reservations, newPaid, expectedPaid, bill.status, bill.paidAt);
        return { error: "Card details are required." };
      }
      const connection = await prisma.squareConnection.findUnique({
        where: { restaurantId: resolved.visit.restaurantId },
      });
      if (!connection) {
        await releaseItemsReserve(bill.id, reservations, newPaid, expectedPaid, bill.status, bill.paidAt);
        return { error: "This venue's card payment isn't available right now." };
      }
      const menuItemIds = clean
        .map((sel) => bill.items.find((it) => it.id === sel.billItemId)!.menuItemId)
        .filter((id): id is string => !!id);
      const squareMaps = menuItemIds.length
        ? await prisma.menuItemSquareMap.findMany({ where: { menuItemId: { in: menuItemIds } } })
        : [];
      const squareMapByMenuItemId = new Map(squareMaps.map((m) => [m.menuItemId, m]));

      const lineItems: SquareChargeLineItem[] = clean.map((sel) => {
        const item = bill.items.find((it) => it.id === sel.billItemId)!;
        const map = item.menuItemId ? squareMapByMenuItemId.get(item.menuItemId) : undefined;
        return {
          name: item.nameSnapshot,
          quantity: sel.count,
          unitPriceCents: item.unitPriceCents,
          menuItemId: item.menuItemId,
          squareVariationId: map?.squareVariationId,
        };
      });

      try {
        const result = await chargeBillViaSquare({
          connection,
          bill: { id: bill.id, tableLabel: resolved.visit.tableLabel },
          lineItems,
          goodsCents: amount,
          tipCents: tip,
          surchargeCents: surcharge,
          currency: bill.currency,
          sourceId,
          idempotencyKey,
        });
        paymentRow = {
          status: result.status,
          provider: "square",
          providerRef: result.providerRef,
          squareOrderId: result.squareOrderId,
          test: paymentContext.squareEnv !== "production",
        };
      } catch (e) {
        await releaseItemsReserve(bill.id, reservations, newPaid, expectedPaid, bill.status, bill.paidAt);
        const detail = e instanceof Error ? e.message : String(e);
        console.error("square.pay_bill_items_failed", { billId: bill.id, error: detail });
        log.warn("payment.square_failed", {
          restaurantId: resolved.visit.restaurantId,
          billId: bill.id,
          error: detail,
        });
        return { error: detail };
      }
    } else {
      const result = await provider.createPayment({
        amountCents: amount + tip + surcharge,
        currency: bill.currency,
        idempotencyKey,
        metadata: {
          billId: bill.id,
          tipCents: String(tip),
          surchargeCents: String(surcharge),
          split: "items",
        },
      });
      paymentRow = {
        status: result.status,
        provider: provider.name,
        providerRef: result.providerRef,
        squareOrderId: null,
        test: result.test,
      };
    }

    await prisma.payment.create({
      data: {
        billId: bill.id,
        amountCents: amount,
        tipCents: tip,
        surchargeCents: surcharge,
        currency: bill.currency,
        status: paymentRow.status,
        provider: paymentRow.provider,
        providerRef: paymentRow.providerRef,
        squareOrderId: paymentRow.squareOrderId,
        idempotencyKey,
        test: paymentRow.test,
      },
    });
    if (paymentRow.squareOrderId) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { squareOrderId: paymentRow.squareOrderId },
      });
    }
    if (tip > 0) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { tipCents: { increment: tip } },
      });
    }

    // Prepay: settling the bill releases any orders that were held for payment.
    if (fullyPaid) await releasePaidOrders(bill.id);

    await notifyRestaurant(resolved.visit.restaurantId);
    log.info("payment.succeeded", {
      restaurantId: resolved.visit.restaurantId,
      billId: bill.id,
      amountCents: amount,
      tipCents: tip,
      surchargeCents: surcharge,
      provider: paymentRow.provider,
      status: paymentRow.status,
      test: paymentRow.test,
      split: "items",
    });
    return {
      paid: true,
      amountPaidCents: amount,
      tipCents: tip,
      surchargeCents: surcharge,
      fullyPaid,
      test: paymentRow.test,
    };
  }

  log.warn("payment.contended", { restaurantId: resolved.visit.restaurantId, billId: null });
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

  await notifyRestaurant(resolved.visit.restaurantId);
  return { ok: true as const };
}

// ---- Refunds -----------------------------------------------------------------

export type RefundActor = { userId: string; email: string };

// Undoes a refundedCents CAS reserve a Square refund call failed to honour —
// same shape as releaseBillReserve/releaseItemsReserve on the payment side.
// Guarded by its own CAS (only succeeds if refundedCents is still exactly
// what the reserve set it to) rather than a blind write.
async function releaseRefundReserve(paymentId: string, reservedRefunded: number, previousRefunded: number) {
  await prisma.payment.updateMany({
    where: { id: paymentId, refundedCents: reservedRefunded },
    data: { refundedCents: previousRefunded },
  });
}

export type RefundOutcome =
  | { ok: true; refundedCents: number; status: "SUCCEEDED" | "PENDING" | "FAILED" }
  | { error: string };

// Refunds a specific payment, full or partial. Always scoped to a payment —
// never the bill in aggregate — so it always ties back to a real processor
// payment id for reconciliation.
//
// This deliberately never changes Bill.status or paidAt. A refund is a
// reversal recorded against a settled bill, not a reopened tab. If it flipped
// a PAID bill back to PARTIALLY_PAID/OPEN, and the table has since moved on
// to a new bill (a very normal sequence — refunds often happen well after the
// table turned over), that write would collide with the one-open-bill-per-
// table partial unique index, which allows only one OPEN/PARTIALLY_PAID bill
// per table. Instead this only adjusts the running paid/tip totals so revenue
// reporting stays accurate, and the Refund row is the audit trail.
//
// Refund money is drawn from the payment in this order: surcharge, then tip,
// then the goods amount — handing back the card fee first, since a venue
// wouldn't expect to keep a surcharge on money it no longer holds.
export async function refundBillPayment(
  paymentId: string,
  restaurantId: string,
  amountCents: number,
  reason: string,
  actor: RefundActor,
): Promise<RefundOutcome> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { error: "Enter a valid refund amount." };
  }
  const cleanReason = reason.trim();
  if (!cleanReason) return { error: "A reason is required." };

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      status: "SUCCEEDED",
      bill: { table: { location: { restaurantId } } },
    },
  });
  if (!payment) return { error: "Payment not found." };

  const envelope = payment.amountCents + payment.tipCents + payment.surchargeCents;
  const provider = getPaymentProvider();

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (!current) return { error: "Payment not found." };

    const refundable = envelope - current.refundedCents;
    if (amountCents > refundable) {
      return {
        error: `Only ${formatCents(refundable, payment.currency)} is refundable on this payment.`,
      };
    }

    const expectedRefunded = current.refundedCents;
    const newRefunded = expectedRefunded + amountCents;

    // Atomic reserve, same CAS pattern as the payment side.
    const cas = await prisma.payment.updateMany({
      where: { id: payment.id, refundedCents: expectedRefunded },
      data: { refundedCents: newRefunded },
    });
    if (cas.count !== 1) continue; // lost the race — re-read and retry

    const idempotencyKey = `refund_${payment.id}_${randomBytes(8).toString("hex")}`;

    let refundRow: {
      status: "PENDING" | "SUCCEEDED" | "FAILED";
      provider: string;
      providerRef: string | undefined;
      test: boolean;
    };

    if (payment.provider === "square") {
      const connection = await prisma.squareConnection.findUnique({ where: { restaurantId } });
      if (!connection) {
        await releaseRefundReserve(payment.id, newRefunded, expectedRefunded);
        return { error: "This venue's card payment isn't available right now." };
      }
      try {
        const result = await refundViaSquare({
          connection,
          squarePaymentId: payment.providerRef ?? "",
          amountCents,
          currency: payment.currency,
          reason: cleanReason,
          idempotencyKey,
        });
        refundRow = {
          status: result.status,
          provider: "square",
          providerRef: result.providerRef,
          test: connection.environment !== "production",
        };
      } catch (e) {
        await releaseRefundReserve(payment.id, newRefunded, expectedRefunded);
        log.warn("payment.refund_square_failed", {
          restaurantId,
          paymentId: payment.id,
          error: e instanceof Error ? e.message : String(e),
        });
        return { error: "Refund failed. Please try again." };
      }
    } else {
      const result = await provider.refundPayment({
        providerRef: payment.providerRef ?? "",
        amountCents,
        idempotencyKey,
        reason: cleanReason,
      });
      refundRow = {
        status: result.status,
        provider: provider.name,
        providerRef: result.providerRef,
        test: result.test,
      };
    }

    await prisma.refund.create({
      data: {
        paymentId: payment.id,
        amountCents,
        reason: cleanReason,
        status: refundRow.status,
        provider: refundRow.provider,
        providerRef: refundRow.providerRef,
        idempotencyKey,
        actorUserId: actor.userId,
        actorEmail: actor.email,
        test: refundRow.test,
      },
    });

    // A Square refund can come back FAILED/REJECTED synchronously (not just
    // via a thrown error) — same rule either way: never leave refundedCents
    // inflated for a refund that didn't happen. PENDING is left alone (funds
    // provisionally held); the refund.updated webhook (Phase 4 Task 3)
    // reconciles it once Square settles on a final status.
    if (payment.provider === "square" && refundRow.status === "FAILED") {
      await releaseRefundReserve(payment.id, newRefunded, expectedRefunded);
    }

    if (refundRow.status === "SUCCEEDED") {
      const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
      const surchargeBound = payment.surchargeCents;
      const tipBound = payment.surchargeCents + payment.tipCents;
      const surchargeRefunded =
        clamp(newRefunded, 0, surchargeBound) - clamp(expectedRefunded, 0, surchargeBound);
      const tipRefunded =
        clamp(newRefunded, surchargeBound, tipBound) -
        clamp(expectedRefunded, surchargeBound, tipBound);
      const goodsRefunded =
        clamp(newRefunded, tipBound, envelope) - clamp(expectedRefunded, tipBound, envelope);
      void surchargeRefunded; // not tracked on Bill — surcharge isn't part of amountPaidCents

      await prisma.bill.update({
        where: { id: payment.billId },
        data: {
          amountPaidCents: { decrement: goodsRefunded },
          tipCents: { decrement: tipRefunded },
          refundedCents: { increment: amountCents },
        },
      });
    }

    await notifyRestaurant(restaurantId);
    log[refundRow.status === "SUCCEEDED" ? "info" : "warn"]("payment.refunded", {
      restaurantId,
      paymentId: payment.id,
      billId: payment.billId,
      amountCents,
      provider: refundRow.provider,
      status: refundRow.status,
      test: refundRow.test,
    });
    return { ok: true, refundedCents: amountCents, status: refundRow.status };
  }

  log.warn("payment.refund_contended", { restaurantId, paymentId: payment.id });
  return { error: "That payment is being updated by someone else. Please try again." };
}

// ---- Square webhook reconciliation (Phase 4) --------------------------------
// Both functions are idempotent no-ops if the stored status already matches —
// safe to call from a webhook handler that may see the same event more than
// once (dedup in /api/square/webhook is the primary guard; this is the
// belt-and-braces backstop).

// payment.updated: Square is the source of truth for what actually happened
// to a payment it processed. Only a transition INTO a failure state needs a
// write here — Square never re-confirms an already-SUCCEEDED payment in a
// way Tillz needs to react to, and a PENDING -> SUCCEEDED move needs no bill
// adjustment (the bill's amountPaidCents was already bumped optimistically
// when the payment was first reserved).
export async function syncSquarePaymentStatus(
  squarePaymentId: string,
  newStatus: PaymentStatus,
): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { provider: "square", providerRef: squarePaymentId },
  });
  if (!payment || payment.status === newStatus) return;

  if (newStatus === "FAILED" && payment.status !== "FAILED") {
    await prisma.$transaction([
      prisma.bill.update({
        where: { id: payment.billId },
        data: {
          amountPaidCents: { decrement: payment.amountCents },
          tipCents: { decrement: payment.tipCents },
        },
      }),
      prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
    ]);
    log.warn("payment.square_webhook_failed", { paymentId: payment.id, billId: payment.billId });
  } else {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: newStatus } });
  }
}

// refund.updated: mirrors the SUCCEEDED/FAILED handling refundBillPayment
// does synchronously, for a refund that was PENDING at request time and only
// now (via webhook) reaches its final Square status. Reconstructs the same
// before/after refundedCents window refundBillPayment would have used — the
// reserve for this specific refund was already applied (and never released,
// since it was PENDING) when the refund was first requested.
export async function syncSquareRefundStatus(
  squareRefundId: string,
  newStatus: RefundStatus,
): Promise<void> {
  const refund = await prisma.refund.findFirst({
    where: { provider: "square", providerRef: squareRefundId },
    include: { payment: true },
  });
  if (!refund || refund.status === newStatus || refund.status !== "PENDING") return;

  const payment = refund.payment;
  const newRefunded = payment.refundedCents; // already includes this refund's reserve
  const previousRefunded = newRefunded - refund.amountCents;

  if (newStatus === "SUCCEEDED") {
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    const envelope = payment.amountCents + payment.tipCents + payment.surchargeCents;
    const surchargeBound = payment.surchargeCents;
    const tipBound = payment.surchargeCents + payment.tipCents;
    const tipRefunded =
      clamp(newRefunded, surchargeBound, tipBound) - clamp(previousRefunded, surchargeBound, tipBound);
    const goodsRefunded =
      clamp(newRefunded, tipBound, envelope) - clamp(previousRefunded, tipBound, envelope);

    await prisma.$transaction([
      prisma.bill.update({
        where: { id: payment.billId },
        data: {
          amountPaidCents: { decrement: goodsRefunded },
          tipCents: { decrement: tipRefunded },
          refundedCents: { increment: refund.amountCents },
        },
      }),
      prisma.refund.update({ where: { id: refund.id }, data: { status: "SUCCEEDED" } }),
    ]);
  } else if (newStatus === "FAILED") {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { refundedCents: previousRefunded },
      }),
      prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } }),
    ]);
    log.warn("payment.refund_square_webhook_failed", { paymentId: payment.id, refundId: refund.id });
  }
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
  await notifyRestaurant(restaurantId);
  return { ok: true as const };
}

// Re-fires already-billed item(s) that need re-cooking — a dropped plate, a
// send-back, a ticket bumped too far by mistake with no way back via recall
// (e.g. it's since been paid and closed). Distinct from recallOrder: that
// un-serves the SAME ticket; this creates a genuinely NEW ticket the kitchen
// sees as fresh work, clearly badged, while re-pointing (never duplicating)
// the existing BillItem rows so the guest is never charged twice — the bill's
// totals are untouched because recompute never runs here; there's nothing to
// recompute since no BillItem's price/quantity/voided state changes, only
// which Order groups it.
export async function refireItems(
  restaurantId: string,
  billItemIds: string[],
  note?: string,
): Promise<{ ok: true; orderId: string } | { error: string }> {
  const ids = [...new Set(billItemIds)].filter(Boolean);
  if (ids.length === 0) return { error: "Select at least one item." };

  const items = await prisma.billItem.findMany({
    where: { id: { in: ids }, bill: { table: { location: { restaurantId } } } },
    include: { bill: { select: { id: true, tableId: true } } },
  });
  if (items.length !== ids.length) return { error: "Some items weren't found." };

  const billId = items[0].bill.id;
  const tableId = items[0].bill.tableId;
  if (items.some((it) => it.bill.id !== billId)) {
    return { error: "Can't re-fire items from different tables at once." };
  }

  const order = await prisma.$transaction(async (tx) => {
    const rest = await tx.restaurant.update({
      where: { id: restaurantId },
      data: { orderSeq: { increment: 1 } },
      select: { orderSeq: true },
    });
    const newOrder = await tx.order.create({
      data: {
        billId,
        tableId,
        restaurantId,
        source: "STAFF",
        status: "SUBMITTED",
        orderNumber: rest.orderSeq,
        isRefire: true,
        note: note?.trim().slice(0, 200) || null,
      },
    });
    await tx.billItem.updateMany({
      where: { id: { in: ids } },
      data: { orderId: newOrder.id },
    });
    return newOrder;
  });

  await notifyRestaurant(restaurantId);
  return { ok: true as const, orderId: order.id };
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
  await notifyRestaurant(restaurantId);
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
  await notifyRestaurant(restaurantId);
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
  await notifyRestaurant(restaurantId);
  return { ok: true as const };
}

// ---- Move / merge tables ----------------------------------------------------
//
// Guests change tables. Two distinct real-world operations, kept distinct
// rather than conflated into one "move" that guesses what you meant:
//  - Move: this table's open bill continues on a different (currently empty)
//    table. Nothing about the bill changes, only which table it's attached to.
//  - Merge: two separate open bills (each may already be partially paid)
//    become one. The surviving bill absorbs the other's items, orders and
//    payment history; the source table's bill is voided and the table frees
//    up. Partial payments are handled properly (summed onto the survivor),
//    not blocked — a table that's already paid part of its tab is exactly
//    the case a "just fold it into that bill" operation needs to get right.

// Repoints an open bill (and its live kitchen tickets) to a different,
// currently-empty table. Order.tableId is denormalized for the kitchen
// screen, so it has to move in the same transaction or tickets already in
// flight would show the wrong table until they're bumped.
export async function moveBill(
  restaurantId: string,
  billId: string,
  toTableId: string,
): Promise<{ ok: true } | { error: string }> {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, status: { in: ["OPEN", "PARTIALLY_PAID"] }, table: { location: { restaurantId } } },
  });
  if (!bill) return { error: "Bill not found or already closed." };

  const toTable = await prisma.table.findFirst({
    where: { id: toTableId, active: true, location: { restaurantId } },
  });
  if (!toTable) return { error: "Table not found." };
  if (toTable.id === bill.tableId) return { error: "Already on that table." };

  const clash = await prisma.bill.findFirst({
    where: { tableId: toTable.id, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
  });
  if (clash) {
    return { error: "That table already has an open bill — use merge instead." };
  }

  await prisma.$transaction([
    prisma.bill.update({ where: { id: bill.id }, data: { tableId: toTable.id } }),
    prisma.order.updateMany({ where: { billId: bill.id }, data: { tableId: toTable.id } }),
  ]);

  await notifyRestaurant(restaurantId);
  return { ok: true as const };
}

// Folds one open bill into another. The target survives; the source is
// voided once everything's been moved off it. Payments already taken against
// the source move with it (audit trail intact) and their amounts are summed
// onto the target's running total — recompute() only re-derives
// subtotal/total from BillItems, it never touches amountPaidCents/tipCents,
// so those are summed explicitly here.
export async function mergeBills(
  restaurantId: string,
  sourceBillId: string,
  targetBillId: string,
): Promise<{ ok: true } | { error: string }> {
  if (sourceBillId === targetBillId) {
    return { error: "Pick two different tables to merge." };
  }

  const [source, target] = await Promise.all([
    prisma.bill.findFirst({
      where: {
        id: sourceBillId,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
        table: { location: { restaurantId } },
      },
    }),
    prisma.bill.findFirst({
      where: {
        id: targetBillId,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
        table: { location: { restaurantId } },
      },
    }),
  ]);
  if (!source || !target) return { error: "Both tables need an open bill to merge." };

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { billId: source.id },
      data: { billId: target.id, tableId: target.tableId },
    });
    await tx.billItem.updateMany({
      where: { billId: source.id },
      data: { billId: target.id },
    });
    // Preserve the payment audit trail on the surviving bill rather than
    // leaving it stranded on one that's about to be voided.
    await tx.payment.updateMany({
      where: { billId: source.id },
      data: { billId: target.id },
    });
    await tx.bill.update({
      where: { id: target.id },
      data: {
        amountPaidCents: { increment: source.amountPaidCents },
        tipCents: { increment: source.tipCents },
        discountCents: { increment: source.discountCents },
      },
    });
    await recompute(tx, target.id);
    // The source table is now empty — void it and zero its stale totals so
    // it never shows a phantom balance with nothing behind it.
    await tx.bill.update({
      where: { id: source.id },
      data: { status: "VOIDED", subtotalCents: 0, totalCents: 0, discountCents: 0 },
    });
  });

  await notifyRestaurant(restaurantId);
  return { ok: true as const };
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
// Shared core behind staffCloseBill and staffCloseBillById: read → CAS the
// remaining balance to PAID → record a mock "counter" Payment → release any
// payment-held orders → notify. `findBill` re-reads fresh on every retry
// attempt (a lost CAS means someone else settled it between our read and
// write), so it must not be memoised by the caller.
async function settleOpenBillAsPaid(
  findBill: () => Promise<{
    id: string;
    totalCents: number;
    amountPaidCents: number;
    currency: string;
    locationId: string | null;
  } | null>,
  restaurantId: string,
  notFoundError: string,
  tenderType: TenderType,
): Promise<{ paid: true } | { error: string }> {
  const provider = getPaymentProvider();

  for (let attempt = 0; attempt < 5; attempt++) {
    const bill = await findBill();
    if (!bill) return { error: notFoundError };

    const remaining = bill.totalCents - bill.amountPaidCents;
    if (remaining <= 0) return { paid: true as const };

    // Resolve any open drawer session for this bill's location. CASH
    // requires one — cash must land in a drawer, so staff can't take a cash
    // payment with nowhere to reconcile it against (see
    // lib/cash-drawer.ts#getZReport). CARD/OTHER attach one when present
    // (so it still shows on that shift's Z-report) but don't require it.
    const session = bill.locationId
      ? await prisma.cashDrawerSession.findFirst({
          where: { locationId: bill.locationId, restaurantId, status: "OPEN" },
        })
      : null;
    if (tenderType === "CASH" && !session) {
      return { error: "Open the drawer before taking cash." };
    }

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
        tenderType,
        cashSessionId: session?.id ?? null,
      },
    });
    // Prepay: staff taking payment also releases any payment-held orders.
    await releasePaidOrders(bill.id);
    await notifyRestaurant(restaurantId);
    return { paid: true as const };
  }
  return { error: "The bill is busy. Please try again." };
}

// tenderType defaults to "OTHER" for the dine-in table flow (this function's
// only caller today is the table page's "Mark as paid (counter / cash)"
// button, which has no tender-choice UI of its own — task 4 only builds that
// for the counter sale screen). "OTHER" rather than "CASH" deliberately: it
// means closing a dine-in table's bill never suddenly starts requiring an
// open drawer, which would be a real, undiscussed behaviour change for a
// flow this build wasn't asked to touch.
export async function staffCloseBill(
  tableId: string,
  restaurantId: string,
  tenderType: TenderType = "OTHER",
) {
  return settleOpenBillAsPaid(
    () =>
      prisma.bill.findFirst({
        where: {
          tableId,
          status: { in: ["OPEN", "PARTIALLY_PAID"] },
          table: { location: { restaurantId } },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          totalCents: true,
          amountPaidCents: true,
          currency: true,
          locationId: true,
        },
      }),
    restaurantId,
    "No open bill on this table.",
    tenderType,
  );
}

// Same as staffCloseBill, but for a counter bill — no table to key off, so
// this is scoped directly by billId + restaurantId instead. The counter
// sale screen (task 4) always passes an explicit tenderType chosen by staff.
export async function staffCloseBillById(
  billId: string,
  restaurantId: string,
  tenderType: TenderType,
) {
  return settleOpenBillAsPaid(
    () =>
      prisma.bill.findFirst({
        where: { id: billId, restaurantId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
        select: {
          id: true,
          totalCents: true,
          amountPaidCents: true,
          currency: true,
          locationId: true,
        },
      }),
    restaurantId,
    "This sale is no longer open.",
    tenderType,
  );
}
