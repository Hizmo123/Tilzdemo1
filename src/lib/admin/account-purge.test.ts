import { describe, it, expect, vi, beforeEach } from "vitest";

// A recording prisma double: every call is logged in order with its args, and
// $transaction hands the callback a tx that records into the SAME log — so the
// test can assert the exact FK-safe order and the scoping of every delete.
const { log_, state, deleteOrganizationFiles } = vi.hoisted(() => ({
  log_: [] as { call: string; args: unknown }[],
  state: { failTxAt: null as string | null, org: null as unknown, restaurants: [] as { id: string }[] },
  deleteOrganizationFiles: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const record = (call: string, args: unknown, result: unknown) => {
    log_.push({ call, args });
    if (state.failTxAt === call) throw new Error(`boom at ${call}`);
    return result;
  };
  const model = (name: string, results: Record<string, unknown> = {}) =>
    new Proxy({}, {
      get: (_t, method: string) => async (args: unknown) =>
        record(`${name}.${method}`, args, method in results ? results[method] : { count: 1 }),
    });
  const tables = () => ({
    refund: model("refund"),
    payment: model("payment"),
    billItem: model("billItem"),
    order: model("order"),
    bill: model("bill"),
    standOrderItem: model("standOrderItem"),
    tillzStand: model("tillzStand"),
    standOrder: model("standOrder"),
    table: model("table"),
    menuCategory: model("menuCategory"),
    staffAccount: model("staffAccount"),
    membership: model("membership"),
    restaurant: model("restaurant", { findMany: undefined }),
    organization: model("organization"),
  });
  const prisma = {
    ...tables(),
    organization: new Proxy({}, {
      get: (_t, method: string) => async (args: unknown) =>
        record(`organization.${method}`, args, method === "findUnique" ? state.org : { count: 1 }),
    }),
    restaurant: new Proxy({}, {
      get: (_t, method: string) => async (args: unknown) =>
        record(`restaurant.${method}`, args, method === "findMany" ? state.restaurants : { count: 2 }),
    }),
    $transaction: async (fn: (tx: unknown) => unknown) => fn(tables()),
  };
  return { prisma };
});
vi.mock("@/lib/account-storage", () => ({ deleteOrganizationFiles }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { purgeDeletedOrganization, purgeEligibility } from "@/lib/admin/account-purge";

const PAST = new Date("2020-01-01T00:00:00.000Z");
const FUTURE = new Date("2099-01-01T00:00:00.000Z");
const deletedOrg = (over: Record<string, unknown> = {}) => ({
  id: "org_1",
  planStatus: "deleted",
  deletionExecutedAt: PAST,
  deletionPurgeEligibleAt: PAST,
  ...over,
});

beforeEach(() => {
  log_.length = 0;
  state.failTxAt = null;
  state.org = deletedOrg();
  state.restaurants = [{ id: "rest_1" }, { id: "rest_2" }];
  deleteOrganizationFiles.mockReset().mockResolvedValue({ removed: 0, failures: [] });
});

describe("purgeEligibility (fails closed)", () => {
  const now = new Date("2030-06-01T00:00:00.000Z");
  it("is eligible only when deleted AND the retention date has passed", () => {
    expect(purgeEligibility({ planStatus: "deleted", deletionExecutedAt: PAST, deletionPurgeEligibleAt: PAST }, now)).toEqual({ ok: true });
  });
  it("is eligible exactly at the boundary instant", () => {
    expect(purgeEligibility({ planStatus: "deleted", deletionExecutedAt: PAST, deletionPurgeEligibleAt: now }, now)).toEqual({ ok: true });
  });
  it("refuses before the retention date, naming it", () => {
    const r = purgeEligibility({ planStatus: "deleted", deletionExecutedAt: PAST, deletionPurgeEligibleAt: FUTURE }, now);
    expect(r).toMatchObject({ error: expect.stringMatching(/retained until .*2099/) });
  });
  it.each(["active", "suspended", "none"])("refuses an org that is merely %s (never owner-deleted)", (planStatus) => {
    expect(purgeEligibility({ planStatus, deletionExecutedAt: null, deletionPurgeEligibleAt: PAST }, now)).toHaveProperty("error");
  });
  it("refuses when planStatus says deleted but the execution timestamp is missing", () => {
    expect(purgeEligibility({ planStatus: "deleted", deletionExecutedAt: null, deletionPurgeEligibleAt: PAST }, now)).toHaveProperty("error");
  });
  it("refuses when there is no retention date at all", () => {
    expect(purgeEligibility({ planStatus: "deleted", deletionExecutedAt: PAST, deletionPurgeEligibleAt: null }, now)).toHaveProperty("error");
  });
});

describe("purgeDeletedOrganization — refusals delete nothing", () => {
  const txCalls = () => log_.map((l) => l.call).filter((c) => c.endsWith(".deleteMany") || c === "organization.delete");

  it("unknown org", async () => {
    state.org = null;
    expect(await purgeDeletedOrganization("nope", "admin_1")).toEqual({ error: "Organisation not found." });
    expect(txCalls()).toEqual([]);
  });

  it("still inside the retention window", async () => {
    state.org = deletedOrg({ deletionPurgeEligibleAt: FUTURE });
    expect(await purgeDeletedOrganization("org_1", "admin_1")).toHaveProperty("error");
    expect(txCalls()).toEqual([]);
    expect(deleteOrganizationFiles).not.toHaveBeenCalled();
  });

  it("an org that was never owner-deleted", async () => {
    state.org = deletedOrg({ planStatus: "active", deletionExecutedAt: null });
    expect(await purgeDeletedOrganization("org_1", "admin_1")).toHaveProperty("error");
    expect(txCalls()).toEqual([]);
  });

  it("ABORTS without deleting any row when the storage re-sweep fails (uploads would be orphaned)", async () => {
    deleteOrganizationFiles.mockResolvedValue({ removed: 0, failures: ["menu-images/rest_1: storage down"] });
    const res = await purgeDeletedOrganization("org_1", "admin_1");
    expect(res).toMatchObject({ error: expect.stringMatching(/nothing was deleted.*storage down/) });
    expect(txCalls()).toEqual([]);
  });
});

describe("purgeDeletedOrganization — the delete itself", () => {
  it("deletes children first in the exact FK-safe order, then the org last", async () => {
    const res = await purgeDeletedOrganization("org_1", "admin_1");
    expect(res).toMatchObject({ ok: true });

    const order = log_.map((l) => l.call).filter((c) => c.endsWith(".deleteMany") || c === "organization.delete");
    expect(order).toEqual([
      "refund.deleteMany", // Refund -> Payment is Restrict
      "payment.deleteMany", // Payment -> Bill is Restrict
      "billItem.deleteMany",
      "order.deleteMany",
      "bill.deleteMany",
      "standOrderItem.deleteMany",
      "tillzStand.deleteMany",
      "standOrder.deleteMany",
      "table.deleteMany",
      "menuCategory.deleteMany",
      "staffAccount.deleteMany",
      "membership.deleteMany",
      "restaurant.deleteMany",
      "organization.delete",
    ]);
    // Restrict-bound rows strictly before the rows they depend on.
    const idx = (c: string) => order.indexOf(c);
    expect(idx("refund.deleteMany")).toBeLessThan(idx("payment.deleteMany"));
    expect(idx("payment.deleteMany")).toBeLessThan(idx("bill.deleteMany"));
    expect(idx("bill.deleteMany")).toBeLessThan(idx("table.deleteMany"));
    expect(idx("table.deleteMany")).toBeLessThan(idx("restaurant.deleteMany"));
  });

  it("scopes EVERY delete to this org — no unscoped deleteMany can wipe another tenant", async () => {
    await purgeDeletedOrganization("org_1", "admin_1");
    for (const { call, args } of log_.filter((l) => l.call.endsWith(".deleteMany") || l.call === "organization.delete")) {
      const where = JSON.stringify((args as { where?: unknown }).where);
      expect(where, `${call} must be scoped`).toBeTruthy();
      expect(where, `${call} must be scoped`).toMatch(/rest_1|org_1/);
      expect(where).not.toBe("{}");
    }
  });

  it("reaches legacy bills (null restaurantId) through their table's location as well", async () => {
    await purgeDeletedOrganization("org_1", "admin_1");
    const billWhere = JSON.stringify(log_.find((l) => l.call === "bill.deleteMany")!.args);
    expect(billWhere).toContain('"restaurantId":{"in":["rest_1","rest_2"]}');
    expect(billWhere).toContain('"table":{"location":{"restaurantId":{"in":["rest_1","rest_2"]}}}');
  });

  it("returns real per-table counts", async () => {
    const res = await purgeDeletedOrganization("org_1", "admin_1");
    // Each deleteMany in the double reports { count: 1 }; the point is that the
    // result carries each step's OWN count (not one shared number).
    expect(res).toMatchObject({
      ok: true,
      counts: { refunds: 1, payments: 1, billItems: 1, orders: 1, bills: 1, tables: 1, menuCategories: 1, restaurants: 1 },
    });
  });

  it("on a mid-purge failure returns an error saying it rolled back, and never claims success", async () => {
    state.failTxAt = "bill.deleteMany";
    const res = await purgeDeletedOrganization("org_1", "admin_1");
    expect(res).toMatchObject({ error: expect.stringMatching(/rolled back.*nothing was deleted.*boom at bill\.deleteMany/) });
    expect(res).not.toHaveProperty("ok");
    // It stopped at the failure — the organisation row was never reached.
    expect(log_.map((l) => l.call)).not.toContain("organization.delete");
  });
});
