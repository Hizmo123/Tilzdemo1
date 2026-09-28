import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAuthz, getActiveLocation, getEntitlements, getInvoicesForExport } = vi.hoisted(() => ({
  getAuthz: vi.fn(),
  getActiveLocation: vi.fn(),
  getEntitlements: vi.fn(),
  getInvoicesForExport: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthz, getActiveLocation }));
vi.mock("@/lib/entitlements", () => ({ getEntitlements }));
vi.mock("@/lib/invoices", () => ({ getInvoicesForExport }));

import { GET } from "./route";

// Regression test for the invoices export leak: this Route Handler had NO
// permission check at all (getActiveLocation only confirms a restaurant
// exists, not a role) and no plan-window clamp — it's a Route Handler, so
// dashboard/invoices/layout.tsx's requireOrdering() never wraps it either.
// GET /dashboard/invoices/export?range=custom&from=2020-01-01&to=2030-01-01
// returned every paid bill's customer name, phone and receipt email as CSV,
// even for a plan whose analyticsWindowDays is 0. Fixed by checking
// bills:view (matching every other bill/invoice/analytics surface) and by
// clamping the range with clampRangeToWindow BEFORE it reaches the query —
// so out-of-window rows are never fetched, not fetched-then-hidden.
const TZ = "Australia/Sydney";
const ctxFixture = {
  user: { id: "user-1" },
  membership: { organizationId: "org-1" },
  restaurant: { id: "rest-1", timezone: TZ, slug: "test-venue" },
  location: { id: "loc-1" },
};

function req(params: string) {
  return new Request(`http://localhost/dashboard/invoices/export?${params}`);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

describe("GET /dashboard/invoices/export", () => {
  beforeEach(() => {
    getAuthz.mockReset();
    getActiveLocation.mockReset();
    getEntitlements.mockReset();
    getInvoicesForExport.mockReset().mockResolvedValue([]);
    getActiveLocation.mockResolvedValue(ctxFixture);
  });

  it("refuses a caller without bills:view — the export never runs", async () => {
    getAuthz.mockResolvedValue({ can: () => false });

    const res = await GET(req("range=custom&from=2020-01-01&to=2030-01-01"));

    expect(res.status).toBe(403);
    expect(getInvoicesForExport).not.toHaveBeenCalled();
  });

  it("404s when the caller has no restaurant, even with bills:view", async () => {
    getAuthz.mockResolvedValue({ can: () => true });
    getActiveLocation.mockResolvedValue(null);

    const res = await GET(req("range=custom&from=2020-01-01&to=2030-01-01"));

    expect(res.status).toBe(404);
    expect(getInvoicesForExport).not.toHaveBeenCalled();
  });

  it("clamps a decade-wide custom range's start date to the plan's window BEFORE querying — the leaking case", async () => {
    getAuthz.mockResolvedValue({ can: () => true });
    getEntitlements.mockResolvedValue({ analyticsWindowDays: 14 });

    // The exact exploit from the audit: a from= a decade back.
    await GET(req(`range=custom&from=2020-01-01&to=${todayStr()}`));

    expect(getInvoicesForExport).toHaveBeenCalledTimes(1);
    const [locationId, range] = getInvoicesForExport.mock.calls[0];
    expect(locationId).toBe("loc-1");
    // `from` must land within the plan's 14-day window of today, nowhere
    // near the 2020-01-01 actually requested — this is the query that
    // reaches the database, so an unclamped `from` here IS the leak.
    const daysBackFromToday = Math.round((Date.now() - range.from.getTime()) / 86_400_000);
    expect(daysBackFromToday).toBeLessThanOrEqual(14);
  });

  it("an unlimited-history plan (analyticsWindowDays: null) is not clamped", async () => {
    getAuthz.mockResolvedValue({ can: () => true });
    getEntitlements.mockResolvedValue({ analyticsWindowDays: null });

    await GET(req(`range=custom&from=2020-01-01&to=${todayStr()}`));

    const [, range] = getInvoicesForExport.mock.calls[0];
    const daysBackFromToday = Math.round((Date.now() - range.from.getTime()) / 86_400_000);
    expect(daysBackFromToday).toBeGreaterThan(2000);
  });
});
