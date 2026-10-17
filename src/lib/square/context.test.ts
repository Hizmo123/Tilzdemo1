import { describe, it, expect, afterEach, vi } from "vitest";
import { mockPaymentsBlocked } from "./context";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mockPaymentsBlocked", () => {
  it("is blocked only when NODE_ENV and SQUARE_ENV are both production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SQUARE_ENV", "production");
    expect(mockPaymentsBlocked()).toBe(true);
  });

  it("is not blocked when NODE_ENV is production but SQUARE_ENV is sandbox", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SQUARE_ENV", "sandbox");
    expect(mockPaymentsBlocked()).toBe(false);
  });

  it("is not blocked when SQUARE_ENV is production but NODE_ENV is not", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SQUARE_ENV", "production");
    expect(mockPaymentsBlocked()).toBe(false);
  });

  it("is not blocked when SQUARE_ENV is unset entirely (reads process.env directly, never throws)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SQUARE_ENV", "");
    expect(mockPaymentsBlocked()).toBe(false);
  });

  it("ALLOW_MOCK_PAYMENTS=true overrides the block even in a genuinely live deployment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SQUARE_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_PAYMENTS", "true");
    expect(mockPaymentsBlocked()).toBe(false);
  });

  it("any other ALLOW_MOCK_PAYMENTS value does NOT override the block", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SQUARE_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_PAYMENTS", "1");
    expect(mockPaymentsBlocked()).toBe(true);
  });
});
