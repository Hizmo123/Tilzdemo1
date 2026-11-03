import { describe, it, expect, afterEach, vi } from "vitest";
import { paidPlansOpen, SELF_ASSIGNABLE_GATED_TIERS } from "./gate";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("paidPlansOpen", () => {
  it("is closed by default (no env configured)", () => {
    expect(paidPlansOpen()).toBe(false);
    expect(paidPlansOpen("some-user")).toBe(false);
  });

  it("PAID_PLANS_OPEN=true opens it for everyone, no user id needed", () => {
    vi.stubEnv("PAID_PLANS_OPEN", "true");
    expect(paidPlansOpen()).toBe(true);
    expect(paidPlansOpen(null)).toBe(true);
  });

  it("a platform admin gets no bypass while the flag is off", () => {
    vi.stubEnv("PLATFORM_ADMIN_USER_IDS", "admin-1");
    expect(paidPlansOpen("admin-1")).toBe(false);
  });
});

describe("SELF_ASSIGNABLE_GATED_TIERS", () => {
  it("is exactly LITE, GROWTH and PRO — CONNECT and BASIC are never gated", () => {
    expect([...SELF_ASSIGNABLE_GATED_TIERS].sort()).toEqual(["GROWTH", "LITE", "PRO"]);
  });
});
