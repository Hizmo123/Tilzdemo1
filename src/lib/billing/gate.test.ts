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

  it("BILLING_ENABLED=true opens it for everyone, no user id needed", () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    expect(paidPlansOpen()).toBe(true);
    expect(paidPlansOpen(null)).toBe(true);
  });

  it("a platform admin bypasses the gate even while the flag is off", () => {
    vi.stubEnv("PLATFORM_ADMIN_USER_IDS", "admin-1, admin-2");
    expect(paidPlansOpen("admin-1")).toBe(true);
    expect(paidPlansOpen("admin-2")).toBe(true);
  });

  it("a non-admin user id with the flag off stays closed", () => {
    vi.stubEnv("PLATFORM_ADMIN_USER_IDS", "admin-1");
    expect(paidPlansOpen("some-other-user")).toBe(false);
  });
});

describe("SELF_ASSIGNABLE_GATED_TIERS", () => {
  it("is exactly LITE, GROWTH and PRO — CONNECT and BASIC are never gated", () => {
    expect([...SELF_ASSIGNABLE_GATED_TIERS].sort()).toEqual(["GROWTH", "LITE", "PRO"]);
  });
});
