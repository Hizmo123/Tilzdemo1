import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { WebhooksHelper } from "square";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { appBaseUrl } from "@/lib/urls";
import { mapSquareStatus, mapSquareRefundStatus } from "@/lib/square/pay";
import { syncSquarePaymentStatus, syncSquareRefundStatus, syncSquareFulfillmentStatus } from "@/lib/bills";

// Square webhook deliveries — the ONLY way Tillz learns about a payment/
// refund that changes status asynchronously (after the initial synchronous
// API call already returned), and the only way it learns a venue disconnected
// Square from Square's own dashboard rather than from Tillz Settings.
//
// Correctness rules for this route specifically:
//   - The raw body is what gets signature-verified — parsing it first and
//     re-serialising would risk a byte-for-byte mismatch against what Square
//     actually signed, so nothing here touches the body as JSON until AFTER
//     verifySignature has passed.
//   - An unverified body is never trusted for anything, not even to decide
//     how to respond — signature failure is always a flat 401 with no body
//     inspection.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-square-hmacsha256-signature");

  if (!signatureHeader) {
    return new NextResponse("Missing signature", { status: 401 });
  }

  const notificationUrl = `${appBaseUrl()}/api/square/webhook`;
  const valid = await WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader,
    signatureKey: env.squareWebhookSignatureKey(),
    notificationUrl,
  });
  if (!valid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let body: {
    event_id?: string;
    type?: string;
    merchant_id?: string;
    data?: { id?: string; object?: Record<string, unknown> };
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid body", { status: 400 });
  }

  const eventId = body.event_id;
  const type = body.type;
  if (!eventId || !type) {
    // Verified but malformed — nothing to dedup or act on. Not Square's
    // fault in the retry sense, so 200 rather than triggering a retry storm.
    return new NextResponse("OK", { status: 200 });
  }

  // Dedup: unique constraint is the actual guard against a concurrent
  // duplicate delivery (Square retries are common); the create failing with
  // a unique violation just means another request already claimed this
  // event, so this one stops here too.
  try {
    await prisma.processedSquareWebhook.create({
      data: { eventId, type, merchantId: body.merchant_id ?? null },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return new NextResponse("OK", { status: 200 });
    }
    throw e;
  }

  try {
    switch (type) {
      case "payment.updated": {
        const payment = body.data?.object?.payment as { id?: string; status?: string } | undefined;
        if (payment?.id) {
          await syncSquarePaymentStatus(payment.id, mapSquareStatus(payment.status));
        }
        break;
      }
      case "refund.updated": {
        const refund = body.data?.object?.refund as { id?: string; status?: string } | undefined;
        if (refund?.id) {
          await syncSquareRefundStatus(refund.id, mapSquareRefundStatus(refund.status));
        }
        break;
      }
      case "oauth.authorization.revoked": {
        if (body.merchant_id) {
          await prisma.squareConnection.updateMany({
            where: { merchantId: body.merchant_id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        break;
      }
      case "order.updated":
        // Best-effort/no-op — Tillz doesn't currently read order state back
        // from Square (Phase 3 only pushes orders one-way for POS/KDS
        // visibility), so there's nothing to reconcile here yet.
        break;
      case "order.fulfillment.updated": {
        // Inbound-only sync: reflects a Square-side kitchen/POS status
        // change on the customer-facing tracker. See
        // syncSquareFulfillmentStatus for the state mapping and the
        // forward-only guard. Requires "order.fulfillment.updated" to be
        // added to the Square webhook subscription (Developer Console) —
        // it isn't one of the events originally subscribed to.
        const fulfillmentEvent = body.data?.object?.order_fulfillment_updated as
          | { order_id?: string; fulfillment_update?: { fulfillment_uid?: string; old_state?: string; new_state?: string }[] }
          | undefined;
        const orderId = fulfillmentEvent?.order_id;
        // Tillz only ever creates one fulfillment per Square order, so no
        // uid filtering is needed — but a payload can still list more than
        // one update entry; the last one is the current state.
        const updates = fulfillmentEvent?.fulfillment_update ?? [];
        const newState = updates.at(-1)?.new_state;
        if (orderId && newState) {
          await syncSquareFulfillmentStatus(orderId, newState);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // The event is already marked processed (dedup row committed above) —
    // an error handling its effects shouldn't make Square retry it forever.
    // Logged for investigation, but still acknowledged.
    log.error("square.webhook_handler_error", { type, eventId, error: e instanceof Error ? e.message : String(e) });
  }

  return new NextResponse("OK", { status: 200 });
}
