import type { SquareConnection } from "@prisma/client";
import type { PaymentStatus, RefundStatus } from "@prisma/client";
import type { Square } from "square";
import { squareClientFor } from "@/lib/square/client";
import { env } from "@/lib/env";

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
  bill: { id: string };
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

  if (!connection.locationId) {
    throw new Error("Square connection has no location selected.");
  }
  const locationId = connection.locationId;

  const client = await squareClientFor(connection);

  // ---- 1. Build the order (ad-hoc pricing — never catalog_object_id, so
  // Square can't substitute its own catalog price for what Tillz charges) --
  const orderLineItems = lineItems.map((li) => ({
    name: li.name,
    quantity: String(li.quantity),
    basePriceMoney: { amount: BigInt(li.unitPriceCents), currency: toCurrency(currency) },
    metadata: {
      tillzMenuItemId: li.menuItemId ?? "",
      ...(li.squareVariationId ? { squareVariationId: li.squareVariationId } : {}),
    },
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

  const orderResponse = await client.orders.create({
    order: {
      locationId,
      lineItems: orderLineItems,
      serviceCharges,
      // PICKUP with no scheduled time (ASAP) just so the order shows up on
      // the venue's Square POS/KDS as something to fulfil — Tillz's own
      // table service isn't a Square fulfillment concept, so this is a
      // minimal placeholder, not a real pickup flow.
      fulfillments: [
        {
          type: "PICKUP",
          state: "PROPOSED",
          pickupDetails: {
            scheduleType: "ASAP",
            note: `Tillz bill ${bill.id}`,
          },
        },
      ],
    },
    idempotencyKey: `${idempotencyKey}:order`,
  });

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

  const paymentResponse = await client.payments.create({
    sourceId,
    idempotencyKey,
    locationId,
    orderId: order.id,
    amountMoney: { amount: BigInt(goodsCents + surchargeCents), currency: toCurrency(currency) },
    ...(tipCents > 0 ? { tipMoney: { amount: BigInt(tipCents), currency: toCurrency(currency) } } : {}),
    ...(appFeeCents > 0 ? { appFeeMoney: { amount: BigInt(appFeeCents), currency: toCurrency(currency) } } : {}),
  });

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
