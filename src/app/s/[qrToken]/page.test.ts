import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirect, resolveStand } = vi.hoisted(() => ({
  redirect: vi.fn(),
  resolveStand: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/stands", () => ({ resolveStand }));

import StandPage from "./page";

// Regression test for the NFC/QR entry-source param: /s/<qrToken> resolves
// to a /v/<token> redirect, and ?src= on the INCOMING request must survive
// onto that redirect target (see lib/entry-source.ts) — redirect() doesn't
// carry query strings forward on its own; the page has to append it.
describe("/s/[qrToken] forwards ?src= onto the redirect target", () => {
  beforeEach(() => {
    redirect.mockReset();
    resolveStand.mockReset();
    resolveStand.mockResolvedValue({ ok: true, redirectTo: "https://app.example.com/v/tok_123" });
  });

  it("src=nfc survives onto the redirect", async () => {
    await StandPage({
      params: Promise.resolve({ qrToken: "stand_1" }),
      searchParams: Promise.resolve({ src: "nfc" }),
    });

    expect(redirect).toHaveBeenCalledWith("https://app.example.com/v/tok_123?src=nfc");
  });

  it("src=qr survives onto the redirect", async () => {
    await StandPage({
      params: Promise.resolve({ qrToken: "stand_1" }),
      searchParams: Promise.resolve({ src: "qr" }),
    });

    expect(redirect).toHaveBeenCalledWith("https://app.example.com/v/tok_123?src=qr");
  });

  it("a missing src defaults to qr on the redirect", async () => {
    await StandPage({
      params: Promise.resolve({ qrToken: "stand_1" }),
      searchParams: Promise.resolve({}),
    });

    expect(redirect).toHaveBeenCalledWith("https://app.example.com/v/tok_123?src=qr");
  });

  it("garbage src is normalised to qr on the redirect, not passed through raw", async () => {
    await StandPage({
      params: Promise.resolve({ qrToken: "stand_1" }),
      searchParams: Promise.resolve({ src: "bluetooth" }),
    });

    expect(redirect).toHaveBeenCalledWith("https://app.example.com/v/tok_123?src=qr");
  });
});
