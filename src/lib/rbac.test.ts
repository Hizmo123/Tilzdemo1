import { describe, it, expect } from "vitest";
import { roleCan } from "@/lib/rbac";

// Regression test for the comp/void/discount permission-tier fix: these
// actions (staffVoidItem, staffCompItem, staffSetDiscount) now gate on
// payments:refund — the SAME bar staffCloseBill's cash-drawer close uses —
// instead of the much lower orders:manage bar any PIN waiter holds. Picking
// the higher of the two existing bars, since a bill zeroed out via
// comp/void/discount is exactly as much a cash-handling risk as the drawer
// close it precedes.
describe("comp/void/discount permission tier", () => {
  it("a basic STAFF (waiter) PIN role is blocked from payments:refund", () => {
    expect(roleCan("STAFF", "payments:refund")).toBe(false);
  });

  it("KITCHEN is also blocked", () => {
    expect(roleCan("KITCHEN", "payments:refund")).toBe(false);
  });

  it("MANAGER and above (the same tier that can close the drawer) is allowed", () => {
    expect(roleCan("MANAGER", "payments:refund")).toBe(true);
    expect(roleCan("OWNER", "payments:refund")).toBe(true);
    expect(roleCan("ADMIN", "payments:refund")).toBe(true);
  });
});
