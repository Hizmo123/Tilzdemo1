import { describe, it, expect, vi, beforeEach } from "vitest";

const { getBillingProvider } = vi.hoisted(() => ({ getBillingProvider: vi.fn() }));
vi.mock("@/lib/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing")>();
  return { ...actual, getBillingProvider };
});
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { POST } from "./route";
import { StripeSignatureError } from "@/lib/billing";

function req(body: string, signature = "sig") {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}

describe("POST /api/stripe/webhook", () => {
  const handleWebhookEvent = vi.fn();

  beforeEach(() => {
    handleWebhookEvent.mockReset();
    getBillingProvider.mockReturnValue({ handleWebhookEvent });
  });

  it("503s when the provider isn't configured", async () => {
    handleWebhookEvent.mockResolvedValue({ configured: false, error: "Billing isn't configured yet." });

    const res = await POST(req("{}"));

    expect(res.status).toBe(503);
  });

  it("400s on an invalid signature, never 503", async () => {
    handleWebhookEvent.mockRejectedValue(new StripeSignatureError("bad signature"));

    const res = await POST(req("{}", "bad-sig"));

    expect(res.status).toBe(400);
  });

  it("500s on an unexpected processing error", async () => {
    handleWebhookEvent.mockRejectedValue(new Error("boom"));

    const res = await POST(req("{}"));

    expect(res.status).toBe(500);
  });

  it("200s when the event is handled", async () => {
    handleWebhookEvent.mockResolvedValue({ configured: true, handled: true });

    const res = await POST(req("{}"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ handled: true });
  });

  it("200s for an event type this app doesn't act on", async () => {
    handleWebhookEvent.mockResolvedValue({ configured: true, handled: false });

    const res = await POST(req("{}"));

    expect(res.status).toBe(200);
  });

  it("passes the raw body text and the stripe-signature header through unparsed", async () => {
    handleWebhookEvent.mockResolvedValue({ configured: true, handled: true });

    await POST(req('{"id":"evt_1"}', "t=1,v1=abc"));

    expect(handleWebhookEvent).toHaveBeenCalledWith({
      payload: '{"id":"evt_1"}',
      signature: "t=1,v1=abc",
    });
  });
});
