import type { SquareConnection } from "@prisma/client";
import type { PaymentStatus, RefundStatus } from "@prisma/client";
import type { Square } from "square";
import { SquareError } from "square";
import { squareClientFor } from "@/lib/square/client";
import { env } from "@/lib/env";

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
  // null check. Logged explicitly (not just guarded) so a MISSING_REQUIRED_
  // PARAMETER on location_id is immediately distinguishable in the logs from
  // one caused by a line item instead.
  console.error("square.charge_location_id", {
    billId: bill.id,
    locationId: connection.locationId || "(empty)",
  });
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

  const orderLineItems = lineItems.map((li) => ({
    name: li.name,
    // Square requires quantity as a string (e.g. "1", "2") — never a number.
    quantity: String(li.quantity),
    basePriceMoney: { amount: BigInt(li.unitPriceCents), currency: toCurrency(currency) },
    metadata: {
      tillzMenuItemId: li.menuItemId ?? "",
      ...(li.squareVariationId ? { squareVariationId: li.squareVariationId } : {}),
    },
  }));

  console.error("square.charge_line_items", {
    billId: bill.id,
    lineItems: orderLineItems.map((li) => ({
      name: li.name,
      quantity: li.quantity,
      quantityType: typeof li.quantity,
      // Number(), not .toString() — same reasoning as the order_body log
      // below: this is a real bigint in the actual request, and logging it
      // as a string here would misleadingly suggest otherwise.
      basePriceMoneyAmount: Number(li.basePriceMoney.amount),
      basePriceMoneyCurrency: li.basePriceMoney.currency,
    })),
  });

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
    idempotencyKey: `${idempotencyKey}:order`,
  };

  // Logging-only concern: native JSON.stringify can't serialise a bigint at
  // all without a replacer, so one is required here just to produce a log
  // line — but returning value.toString() (a string) makes a correctly-typed
  // bigint amount print as a QUOTED "2000" in the log, which reads exactly
  // like the real request carries a string, even though it doesn't. The
  // actual request object below (orderRequest, passed to client.orders.create
  // untouched by this JSON.stringify call) still holds real bigints — the
  // SDK's own wire serialiser (core/json.js toJson) converts those to
  // genuine unquoted JSON numbers. Number(...) here mirrors that for the log
  // (cents amounts are always far below Number.MAX_SAFE_INTEGER), so what's
  // logged actually matches what goes over the wire.
  console.error(
    "square.order_body",
    JSON.stringify(orderRequest, (_key, value) => (typeof value === "bigint" ? Number(value) : value)),
  );

  let orderResponse;
  try {
    orderResponse = await client.orders.create(orderRequest);
  } catch (e) {
    const detail = formatSquareError(e);
    console.error("square.create_order_failed", {
      billId: bill.id,
      goodsCents,
      surchargeCents,
      currency,
      error: detail,
    });
    throw new Error(`Square order creation failed — ${detail}`);
  }

  const order = orderResponse.order;
  if (!order?.id) {
    console.error("square.create_order_no_id", { billId: bill.id, response: orderResponse });
    throw new Error("Square did not return an order id.");
  }

  // ---- 2. Assert the order's computed total matches exactly -----------------
  const expectedCents = goodsCents + surchargeCents;
  const actualCents = order.totalMoney?.amount != null ? Number(order.totalMoney.amount) : NaN;
  if (actualCents !== expectedCents) {
    console.error("square.order_total_mismatch", {
      billId: bill.id,
      orderId: order.id,
      expectedCents,
      actualCents,
      goodsCents,
      surchargeCents,
      currency,
    });
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
      idempotencyKey,
      locationId,
      orderId: order.id,
      amountMoney: { amount: BigInt(goodsCents + surchargeCents), currency: toCurrency(currency) },
      ...(tipCents > 0 ? { tipMoney: { amount: BigInt(tipCents), currency: toCurrency(currency) } } : {}),
      ...(appFeeCents > 0 ? { appFeeMoney: { amount: BigInt(appFeeCents), currency: toCurrency(currency) } } : {}),
    });
  } catch (e) {
    const detail = formatSquareError(e);
    console.error("square.create_payment_failed", {
      billId: bill.id,
      orderId: order.id,
      expectedOrderTotalCents: expectedCents,
      amountSentCents: goodsCents + surchargeCents,
      tipCents,
      appFeeCents,
      currency,
      error: detail,
    });
    throw new Error(`Square payment failed — ${detail}`);
  }

  const payment = paymentResponse.payment;
  if (!payment?.id) {
    console.error("square.create_payment_no_id", { billId: bill.id, orderId: order.id, response: paymentResponse });
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
    idempotencyKey,
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
