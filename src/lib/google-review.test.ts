import { describe, it, expect } from "vitest";
import { normalizeGoogleReviewUrl } from "@/lib/google-review";

describe("normalizeGoogleReviewUrl", () => {
  it("a bare Place ID is converted to the full write-review URL", () => {
    const res = normalizeGoogleReviewUrl("ChIJN1t_tDeuEmsRUsoyG83frY4");
    expect(res).toEqual({
      ok: true,
      url: "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    });
  });

  it("a g.page link is accepted as-is", () => {
    const res = normalizeGoogleReviewUrl("https://g.page/r/CSomeReviewCode/review");
    expect(res).toEqual({ ok: true, url: "https://g.page/r/CSomeReviewCode/review" });
  });

  it("a maps.app.goo.gl link is accepted", () => {
    const res = normalizeGoogleReviewUrl("https://maps.app.goo.gl/AbCdEf123");
    expect(res.ok).toBe(true);
  });

  it("a search.google.com writereview link is accepted", () => {
    const res = normalizeGoogleReviewUrl(
      "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
    expect(res.ok).toBe(true);
  });

  it("a non-Google URL is rejected", () => {
    const res = normalizeGoogleReviewUrl("https://example.com/leave-a-review");
    expect(res.ok).toBe(false);
  });

  it("a Google-lookalike hostname (subdomain trick) is rejected", () => {
    const res = normalizeGoogleReviewUrl("https://search.google.com.evil.com/writereview");
    expect(res.ok).toBe(false);
  });

  it("http (not https) is rejected even on an allowed host", () => {
    const res = normalizeGoogleReviewUrl("http://g.page/r/CSomeReviewCode/review");
    expect(res.ok).toBe(false);
  });

  it("a javascript: URL is rejected", () => {
    const res = normalizeGoogleReviewUrl("javascript:alert(1)");
    expect(res.ok).toBe(false);
  });

  it("empty input is rejected with a clear message", () => {
    const res = normalizeGoogleReviewUrl("");
    expect(res).toEqual({ ok: false, error: "Paste a review link or Place ID." });
  });

  it("whitespace-only input is rejected the same as empty", () => {
    const res = normalizeGoogleReviewUrl("   ");
    expect(res.ok).toBe(false);
  });

  it("garbage starting with ChIJ but containing a scheme is rejected, not mistaken for a Place ID", () => {
    const res = normalizeGoogleReviewUrl("ChIJhttps://evil.com");
    expect(res.ok).toBe(false);
  });
});
