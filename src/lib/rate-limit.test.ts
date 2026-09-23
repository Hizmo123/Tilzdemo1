import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

// The staff-login page regex from middleware.ts — must match ONLY the bare
// /staff/<slug> login page, never a deeper operational route (kitchen board,
// home floor, table service) that legitimately polls every few seconds and
// must not share this budget.
const STAFF_LOGIN_MATCH = /^\/staff\/[^/]+\/?$/;

describe("staff-login rate-limit route matching", () => {
  it("matches the bare login page, with or without trailing slash", () => {
    expect(STAFF_LOGIN_MATCH.test("/staff/my-venue")).toBe(true);
    expect(STAFF_LOGIN_MATCH.test("/staff/my-venue/")).toBe(true);
  });

  it("does NOT match deeper operational routes that poll frequently", () => {
    expect(STAFF_LOGIN_MATCH.test("/staff/my-venue/home")).toBe(false);
    expect(STAFF_LOGIN_MATCH.test("/staff/my-venue/kitchen")).toBe(false);
    expect(STAFF_LOGIN_MATCH.test("/staff/my-venue/table/123")).toBe(false);
  });
});

// Regression test for the staff-roster brute-force gap: per-account lockout
// (5 bad PINs locks ONE account) already existed, but nothing previously
// capped how many DIFFERENT staff accounts one source could attack in a
// burst. The middleware rule keys on `${rule.key}:${ip}` — a FIXED key, not
// per-staff-name — so hammering many different names from one IP shares one
// budget instead of getting a fresh allowance per name.
describe("checkRateLimit: shared budget across many distinct target names from one source", () => {
  it("rate-limits a single source after `limit` requests, regardless of which staff name each attempt targets", () => {
    const key = `/staff/:login:1.2.3.4-${Math.random()}`; // unique per test run
    const limit = 5;
    const names = ["alice", "bob", "carol", "dave", "erin", "frank"];

    const results = names.map(() => checkRateLimit(key, limit, 60_000));

    // First 5 attempts (across 5 different staff names) are allowed...
    expect(results.slice(0, 5).every((r) => r.allowed)).toBe(true);
    // ...but the 6th, targeting yet another name from the same source, is not.
    expect(results[5].allowed).toBe(false);
  });

  it("a different source (different key) gets its own independent budget", () => {
    const keyA = `/staff/:login:9.9.9.1-${Math.random()}`;
    const keyB = `/staff/:login:9.9.9.2-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(keyA, 5, 60_000);
    expect(checkRateLimit(keyA, 5, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 5, 60_000).allowed).toBe(true);
  });
});
