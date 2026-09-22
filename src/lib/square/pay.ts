import { createHash } from "crypto";
import type { SquareConnection } from "@prisma/client";
import type { PaymentStatus, RefundStatus } from "@prisma/client";
import type { Square } from "square";
import { SquareError } from "square";
import { squareClientFor } from "@/lib/square/client";
import { env } from "@/lib/env";

// Square caps idempotency_key at 45 characters. Tillz's own idempotency keys
// (built in lib/bills.ts — e.g. "pay_<bill cuid>_<16 hex chars>" — also
// stored as Payment.idempotencyKey/Refund.idempotencyKey for DB-level
// uniqueness) run well past that once a bill's cuid and a distinguishing
// suffix are involved, and are never trimmed for that DB role. This derives
// a short, per-purpose key from the same base string for Square's wire
// parameter instead: SHA-256 is deterministic, so the SAME base always
// produces the SAME derived key (retries of one logical attempt stay
// consistent), and "order"/"payment"/"refund" each get their own key from a
// single base via a distinct prefix, satisfying Square's "different
// idempotency key per distinct request" rule.
function squareIdempotencyKey(base: string, purpose: "order" | "payment" | "refund"): string {
  const hash = createHash("sha256").update(base).digest("hex").slice(0, 32);
  const prefix = purpose === "order" ? "o_" : purpose === "payment" ? "p_" : "r_";
  return `${prefix}${hash}`; // 2 + 32 = 34 chars, comfortably under the 45-char cap
}

// Turns a thrown Square API error into a specific, debuggable message —
// "category/code: detail" per structured error entry — instead of the
// generic "payment failed" a customer or a log line is otherwise left with.
// Exported so callers (bills.ts) can log/report the same detail rather than
// re-deriving it from a caught error.
export function formatSquareError(e: unknown): string {
  if (e instanceof SquareError && e.errors.length > 0) {
    return e.errors
      .map((err) => `${err.category}/${err.code}${err.detail ? `: ${err.detail}` : ""}`)
      .join("; ");
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export type SquareErrorKind = "declined" | "error";

// Square buckets every card-specific failure (a real decline, CVV mismatch,
// expired card, insufficient funds, etc.) under the PAYMENT_METHOD_ERROR
// category — checking that one category covers the whole "try a different
// card" class the customer-facing message needs to distinguish from an
// infrastructural/configuration failure.
function classifySquareError(e: unknown): { kind: SquareErrorKind; friendlyMessage: string } {
  if (e instanceof SquareError && e.errors.some((err) => err.category === "PAYMENT_METHOD_ERROR")) {
    return { kind: "declined", friendlyMessage: "Your card was declined. Please try another card." };
  }
  return { kind: "error", friendlyMessage: "Your payment couldn't be processed. Please try again." };
}

// Thrown instead of a plain Error on a failed Square order/payment call.
// `.message` (Error's own field) stays the FULL diagnostic detail —
// category/code/detail via formatSquareError — for server-side logs;
// `.friendlyMessage`/`.kind` are what's safe to return to the customer.
// Never let `.message` reach the client; always use `.friendlyMessage` there.
export class SquarePaymentError extends Error {
  readonly kind: SquareErrorKind;
  readonly friendlyMessage: string;
  constructor(detail: string, kind: SquareErrorKind, friendlyMessage: string) {
    super(detail);
    this.name = "SquarePaymentError";
    this.kind = kind;
    this.friendlyMessage = friendlyMessage;
  }
}

// Charges a card via Square for the EXACT amount Tillz computed. The two
// highest-risk invariants in this whole phase live here:
//   1. The Square Order's own computed total must equal what we intend to
//      charge (goods + surcharge) before any Payment is created — if Square's
//      own tax/rounding/whatever produces a different number, we refuse to
//      charge rather than let Square silently decide the amount.
//   2. sourceId is the ONLY card-shaped thing this function (or anything else
//      on the server) ever touches — it's a one-time token the Web Payments
//      SDK produces client-side; the actual card number never reaches here.

export class SquarePriceMismatchError extends Error {
  constructor(expectedCents: number, actualCents: number) {
    super(`Square order total (${actualCents}c) did not match the expected charge (${expectedCents}c)`);
    this.name = "SquarePriceMismatchError";
  }
}

export type SquareChargeLineItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  menuItemId?: string | null;
  squareVariationId?: string | null;
  // Shown on the venue's Square KDS/POS under the line — used for a chosen-
  // modifiers summary (e.g. "Full cream, Regular") so the kitchen can see
  // what to actually make, not just the item name.
  note?: string | null;
};

export type ChargeBillViaSquareInput = {
  connection: SquareConnection;
  // tableLabel is shown to the venue on their Square KDS/POS as the pickup
  // fulfillment's recipient.displayName (Square has no first-class dine-in
  // table concept — PICKUP is the closest fit for a QR table order).
  bill: { id: string; tableLabel?: string | null };
  // The line items THIS CHARGE covers — not necessarily every item on the
  // bill. For a full or item-split payment these are real menu lines (so the
  // order is itemised for the venue's Square POS/KDS); for an equal-split or
  // custom-dollar-amount payment there's no set of specific items that sums
  // to an arbitrary partial amount, so the caller passes a single line
  // representing the amount being charged. Either way, the sum of
  // (unitPriceCents * quantity) across lineItems MUST equal goodsCents — that
  // sum is what step 2 below verifies Square agrees on before charging.
  lineItems: SquareChargeLineItem[];
  goodsCents: number;
  tipCents: number;
  surchargeCents: number;
  currency: string;
  sourceId: string;
  idempotencyKey: string;
};

export type ChargeBillViaSquareResult = {
  status: PaymentStatus;
  providerRef: string;
  squareOrderId: string;
};

// Tillz stores currency as a plain string (always a real ISO 4217 code, e.g.
// "AUD" — see Restaurant.currency); Square's SDK types it as a closed enum.
// A venue's currency is never user-freeform text, so this cast is safe.
function toCurrency(currency: string): Square.Currency {
  return currency as Square.Currency;
}

export function mapSquareStatus(status: string | undefined): PaymentStatus {
  if (status === "COMPLETED" || status === "APPROVED") return "SUCCEEDED";
  if (status === "CANCELED" || status === "FAILED") return "FAILED";
  return "PENDING";
}

export async function chargeBillViaSquare(
  input: ChargeBillViaSquareInput,
): Promise<ChargeBillViaSquareResult> {
  const { connection, bill, lineItems, goodsCents, tipCents, surchargeCents, currency, sourceId, idempotencyKey } =
    input;

  // location_id is required on the Order itself — an empty string is just as
  // unusable as null/undefined here, so this is a falsy check, not a strict
  // null check.
  if (!connection.locationId) {
    throw new Error("Square connection has no location selected.");
  }
  const locationId = connection.locationId;

  const client = await squareClientFor(connection);

  // ---- 1. Build the order (ad-hoc pricing — never catalog_object_id, so
  // Square can't substitute its own catalog price for what Tillz charges) --
  // Every line item MUST carry a non-empty name, a quantity serialised as a
  // STRING (Square's OrderLineItem.quantity is a string field — sending a
  // number here is exactly what produces MISSING_REQUIRED_PARAMETER, since
  // Square's API doesn't coerce it), and a base_price_money with both amount
  // and currency. Validated up front — with the offending item identified —
  // rather than letting a malformed item reach Square as a cryptic 400.
  lineItems.forEach((li, i) => {
    if (!li.name || !li.name.trim()) {
      throw new Error(`Square line item ${i} is missing a name.`);
    }
    if (!Number.isInteger(li.quantity) || li.quantity <= 0) {
      throw new Error(`Square line item "${li.name}" has an invalid quantity: ${li.quantity}`);
    }
    if (!Number.isInteger(li.unitPriceCents) || li.unitPriceCents < 0) {
      throw new Error(`Square line item "${li.name}" has an invalid price: ${li.unitPriceCents}`);
    }
  });

  // Square rejects order metadata containing an empty-string value (this was
  // the actual MISSING_REQUIRED_PARAMETER cause: tillzMenuItemId was always
  // included, even as "" when a line item had no menuItemId, e.g. the
  // single ad-hoc "Bill payment (full)" line payBillAmount sends). Build the
  // metadata key-by-key, keeping only non-empty string values, and omit the
  // whole field when nothing survives — never send metadata: {} either.
  function buildMetadata(li: SquareChargeLineItem): Record<string, string> | undefined {
    const entries: [string, string][] = [];
    if (li.menuItemId && li.menuItemId.trim()) entries.push(["tillzMenuItemId", li.menuItemId]);
    if (li.squareVariationId && li.squareVariationId.trim()) {
      entries.push(["squareVariationId", li.squareVariationId]);
    }
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  const orderLineItems = lineItems.map((li) => ({
    name: li.name,
    // Square requires quantity as a string (e.g. "1", "2") — never a number.
    quantity: String(li.quantity),
    basePriceMoney: { amount: BigInt(li.unitPriceCents), currency: toCurrency(currency) },
    metadata: buildMetadata(li),
    // Same empty-string rule as metadata — an empty/whitespace note is
    // omitted rather than sent as "".
    ...(li.note && li.note.trim() ? { note: li.note.trim() } : {}),
  }));

  const serviceCharges =
    surchargeCents > 0
      ? [
          {
            name: "Card surcharge",
            amountMoney: { amount: BigInt(surchargeCents), currency: toCurrency(currency) },
            calculationPhase: "SUBTOTAL_PHASE" as const,
          },
        ]
      : undefined;

  // PICKUP is the closest fit for a QR table order — Square has no
  // first-class dine-in/table fulfillment type. recipient.displayName is
  // REQUIRED (this is what showed up as MISSING_REQUIRED_PARAMETER: the
  // fulfillment was being sent with neither a recipient nor a pickupAt) and
  // is what the venue actually sees on their Square KDS/POS, so it carries
  // the Tillz table label rather than a generic placeholder. scheduleType
  // ASAP still requires pickupAt to be set — Square does not default it.
  const pickupAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const orderRequest = {
    order: {
      locationId,
      lineItems: orderLineItems,
      serviceCharges,
      fulfillments: [
        {
          type: "PICKUP" as const,
          state: "PROPOSED" as const,
          pickupDetails: {
            recipient: { displayName: bill.tableLabel?.trim() || "Tillz order" },
            scheduleType: "ASAP" as const,
            pickupAt,
            note: `Tillz bill ${bill.id}`,
          },
        },
      ],
    },
    idempotencyKey: squareIdempotencyKey(idempotencyKey, "order"),
  };

  let orderResponse;
  try {
    orderResponse = await client.orders.create(orderRequest);
  } catch (e) {
    const { kind, friendlyMessage } = classifySquareError(e);
    throw new SquarePaymentError(`Square order creation failed — ${formatSquareError(e)}`, kind, friendlyMessage);
  }

  const order = orderResponse.order;
  if (!order?.id) {
    throw new Error("Square did not return an order id.");
  }

  // ---- 2. Assert the order's computed total matches exactly -----------------
  const expectedCents = goodsCents + surchargeCents;
  const actualCents = order.totalMoney?.amount != null ? Number(order.totalMoney.amount) : NaN;
  if (actualCents !== expectedCents) {
    throw new SquarePriceMismatchError(expectedCents, actualCents);
  }

  // ---- 3. Create the payment --------------------------------------------------
  // Tillz's application fee (SQUARE_APP_FEE_BPS) on the goods amount only —
  // never on tip or surcharge — capped at 90% of the total amount actually
  // charged to the card, matching Square's own hard limit on appFeeMoney.
  const totalChargeCents = goodsCents + tipCents + surchargeCents;
  const appFeeBps = env.squareAppFeeBps();
  const appFeeCents = Math.min(
    Math.floor((goodsCents * appFeeBps) / 10000),
    Math.floor(totalChargeCents * 0.9),
  );

  let paymentResponse;
  try {
    paymentResponse = await client.payments.create({
      sourceId,
      idempotencyKey: squareIdempotencyKey(idempotencyKey, "payment"),
      locationId,
      orderId: order.id,
      amountMoney: { amount: BigInt(goodsCents + surchargeCents), currency: toCurrency(currency) },
      ...(tipCents > 0 ? { tipMoney: { amount: BigInt(tipCents), currency: toCurrency(currency) } } : {}),
      ...(appFeeCents > 0 ? { appFeeMoney: { amount: BigInt(appFeeCents), currency: toCurrency(currency) } } : {}),
    });
  } catch (e) {
    const { kind, friendlyMessage } = classifySquareError(e);
    throw new SquarePaymentError(`Square payment failed — ${formatSquareError(e)}`, kind, friendlyMessage);
  }

  const payment = paymentResponse.payment;
  if (!payment?.id) {
    throw new Error("Square did not return a payment id.");
  }

  return {
    status: mapSquareStatus(payment.status),
    providerRef: payment.id,
    squareOrderId: order.id,
  };
}

// Square's refund status values are PENDING/COMPLETED/REJECTED/FAILED —
// Tillz's RefundStatus enum only has PENDING/SUCCEEDED/FAILED (no separate
// "rejected" state), so REJECTED folds into FAILED here; both mean the
// refund didn't happen and refundedCents must be released either way.
export function mapSquareRefundStatus(status: string | undefined): RefundStatus {
  if (status === "COMPLETED") return "SUCCEEDED";
  if (status === "REJECTED" || status === "FAILED") return "FAILED";
  return "PENDING";
}

export type RefundViaSquareInput = {
  connection: SquareConnection;
  // The Square Payment id being refunded — Payment.providerRef.
  squarePaymentId: string;
  amountCents: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
};

export type RefundViaSquareResult = {
  status: RefundStatus;
  providerRef: string;
};

// Refunds (fully or partially) a payment previously taken via
// chargeBillViaSquare. Deliberately never sets app_fee_money — Square
// prorates Tillz's application fee refund automatically to match the
// refunded portion, which is the correct behaviour for both full and
// partial refunds without Tillz having to compute it here.
export async function refundViaSquare(input: RefundViaSquareInput): Promise<RefundViaSquareResult> {
  const { connection, squarePaymentId, amountCents, currency, reason, idempotencyKey } = input;

  const client = await squareClientFor(connection);
  const response = await client.refunds.refundPayment({
    idempotencyKey: squareIdempotencyKey(idempotencyKey, "refund"),
    paymentId: squarePaymentId,
    amountMoney: { amount: BigInt(amountCents), currency: toCurrency(currency) },
    reason,
  });

  const refund = response.refund;
  if (!refund?.id) {
    throw new Error("Square did not return a refund id.");
  }

  return {
    status: mapSquareRefundStatus(refund.status ?? undefined),
    providerRef: refund.id,
  };
}
