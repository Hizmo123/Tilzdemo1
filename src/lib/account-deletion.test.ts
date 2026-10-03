import { describe, it, expect, vi, beforeEach } from "vitest";

// A prisma double with an ALLOW-LIST. Any model/method outside it throws the
// moment executeAccountDeletion reaches for it — which turns the most
// important property of this feature ("financial records are never touched
// on deletion") from a code-review claim into a failing test.
const { calls, allowed, sendEmail, revoke, deleteOrganizationFiles } = vi.hoisted(() => {
  const calls: string[] = [];
  const allowed = new Set([
    "organization.findUnique",
    "organization.updateMany",
    "restaurant.updateMany", // unpublish + branding reset ONLY — never delete/deleteMany
    "squareConnection.findMany",
    "squareConnection.delete",
    "menuCategory.deleteMany",
    "staffAccount.deleteMany",
    "staffInvite.deleteMany",
  ]);
  return {
    calls,
    allowed,
    sendEmail: vi.fn(),
    revoke: vi.fn(),
    deleteOrganizationFiles: vi.fn(),
  };
});

const results: Record<string, unknown> = {};
vi.mock("@/lib/prisma", () => {
  const prisma = new Proxy(
    {},
    {
      get: (_t, model: string) =>
        new Proxy(
          {},
          {
            get: (_m, method: string) => async (args?: unknown) => {
              const key = `${model}.${method}`;
              calls.push(key);
              if (!allowed.has(key)) {
                throw new Error(`FORBIDDEN: executeAccountDeletion called prisma.${key} — it must never touch this`);
              }
              const r = results[key];
              return typeof r === "function" ? (r as (a: unknown) => unknown)(args) : r;
            },
          },
        ),
    },
  );
  return { prisma };
});
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/square/oauth", () => ({ revoke }));
vi.mock("@/lib/account-storage", () => ({ deleteOrganizationFiles }));
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { executeAccountDeletion } from "@/lib/account";

const ORG = {
  id: "org_1",
  name: "Harbour Kitchen",
  planStatus: "active",
  deactivatedAt: null,
  deletionExecutedAt: null,
  restaurants: [{ id: "rest_1" }, { id: "rest_2" }],
};

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(results)) delete results[k];
  sendEmail.mockReset().mockResolvedValue({ ok: true, provider: "mock", test: true });
  revoke.mockReset().mockResolvedValue(undefined);
  deleteOrganizationFiles.mockReset().mockResolvedValue({ removed: 4, failures: [] });
  results["organization.findUnique"] = { ...ORG };
  results["organization.updateMany"] = { count: 1 };
  results["restaurant.updateMany"] = { count: 2 };
  results["squareConnection.findMany"] = [];
  results["menuCategory.deleteMany"] = { count: 3 };
  results["staffAccount.deleteMany"] = { count: 2 };
  results["staffInvite.deleteMany"] = { count: 0 };
});

describe("executeAccountDeletion — guards", () => {
  it("refuses an unknown organisation", async () => {
    results["organization.findUnique"] = null;
    expect(await executeAccountDeletion("nope", "o@x.com")).toEqual({ error: "Account not found." });
    expect(calls).toEqual(["organization.findUnique"]);
  });

  it("refuses an already-deleted account (by deletionExecutedAt) and writes nothing", async () => {
    results["organization.findUnique"] = { ...ORG, deletionExecutedAt: new Date() };
    const res = await executeAccountDeletion("org_1", "o@x.com");
    expect(res).toEqual({ error: "This account has already been deleted." });
    expect(calls).toEqual(["organization.findUnique"]);
  });

  it("refuses an already-deleted account (by planStatus) and writes nothing", async () => {
    results["organization.findUnique"] = { ...ORG, planStatus: "deleted" };
    expect(await executeAccountDeletion("org_1", "o@x.com")).toEqual({ error: "This account has already been deleted." });
    expect(calls).toEqual(["organization.findUnique"]);
  });

  it("refuses a suspended account with a support pointer, and writes nothing", async () => {
    results["organization.findUnique"] = { ...ORG, deactivatedAt: new Date(), planStatus: "suspended" };
    const res = await executeAccountDeletion("org_1", "o@x.com");
    expect(res).toMatchObject({ error: expect.stringMatching(/suspended.*Tap-to-It support/) });
    expect(calls).toEqual(["organization.findUnique"]);
  });

  it("loses a double-click race cleanly: the atomic claim matching 0 rows does no cleanup at all", async () => {
    results["organization.updateMany"] = { count: 0 };
    const res = await executeAccountDeletion("org_1", "o@x.com");
    expect(res).toMatchObject({ error: expect.stringMatching(/just changed/) });
    expect(calls).toEqual(["organization.findUnique", "organization.updateMany"]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(deleteOrganizationFiles).not.toHaveBeenCalled();
  });
});

describe("executeAccountDeletion — the claim", () => {
  it("is guarded on nothing having been deleted/suspended yet, and sets every closure field at once", async () => {
    const before = Date.now();
    await executeAccountDeletion("org_1", "owner@x.com");

    const updateMany = vi.fn();
    // Re-run capturing args (the proxy double doesn't record them).
    results["organization.updateMany"] = (args: unknown) => {
      updateMany(args);
      return { count: 1 };
    };
    calls.length = 0;
    const res = await executeAccountDeletion("org_1", "owner@x.com");
    expect(res).toMatchObject({ ok: true });

    const { where, data } = updateMany.mock.calls[0][0];
    expect(where).toEqual({
      id: "org_1",
      deletionExecutedAt: null,
      deactivatedAt: null,
      planStatus: { not: "deleted" },
    });
    expect(data).toMatchObject({
      deactivatedByEmail: "owner@x.com",
      deletedByEmail: "owner@x.com",
      planStatus: "deleted",
      plan: "LITE",
      cardLast4: null,
      trialEndsAt: null,
    });
    // deactivatedAt IS the login block; it must equal deletionExecutedAt (one instant).
    expect(data.deactivatedAt).toBeInstanceOf(Date);
    expect(data.deactivatedAt.getTime()).toBe(data.deletionExecutedAt.getTime());
    expect(data.deactivatedAt.getTime()).toBeGreaterThanOrEqual(before);
    // Retention is exactly 5 calendar years from that instant.
    const eligible: Date = data.deletionPurgeEligibleAt;
    expect(eligible.getFullYear() - data.deletionExecutedAt.getFullYear()).toBe(5);
    expect(eligible.getMonth()).toBe(data.deletionExecutedAt.getMonth());
  });
});

describe("executeAccountDeletion — what it touches", () => {
  it("only ever uses the allow-listed models, and NEVER a financial table, Table, Location or Restaurant delete", async () => {
    const res = await executeAccountDeletion("org_1", "owner@x.com");
    expect(res).toMatchObject({ ok: true, orgName: "Harbour Kitchen", cleanupFailures: [] });

    // The Proxy throws on anything off the list; if it had, cleanupFailures
    // would be non-empty (attempt() catches per step) — so also assert the raw call log.
    const touched = new Set(calls.map((c) => c.split(".")[0]));
    for (const forbidden of ["bill", "billItem", "order", "payment", "refund", "table", "location", "standOrder", "standOrderItem", "tillzStand", "membership", "auditLog"]) {
      expect(touched.has(forbidden), `touched forbidden model ${forbidden}`).toBe(false);
    }
    expect(calls).not.toContain("restaurant.delete");
    expect(calls).not.toContain("restaurant.deleteMany");
    expect(calls).not.toContain("organization.delete");
    expect(calls.filter((c) => !allowed.has(c))).toEqual([]);
  });

  it("deletes menu, staff and invites, sweeps files for every venue, and unpublishes", async () => {
    await executeAccountDeletion("org_1", "owner@x.com");
    expect(calls).toEqual(
      expect.arrayContaining([
        "restaurant.updateMany",
        "menuCategory.deleteMany",
        "staffAccount.deleteMany",
        "staffInvite.deleteMany",
      ]),
    );
    expect(deleteOrganizationFiles).toHaveBeenCalledWith("org_1", ["rest_1", "rest_2"]);
  });

  it("revokes then deletes each Square connection, and still deletes it if the revoke call fails", async () => {
    results["squareConnection.findMany"] = [{ id: "sq_1" }, { id: "sq_2" }];
    revoke.mockRejectedValueOnce(new Error("Square down")).mockResolvedValueOnce(undefined);

    const res = await executeAccountDeletion("org_1", "owner@x.com");

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(calls.filter((c) => c === "squareConnection.delete")).toHaveLength(2);
    expect(res).toMatchObject({ ok: true, cleanupFailures: [] });
  });

  it("stays a success — with the failure reported, not thrown — when a cleanup step fails after the claim", async () => {
    results["menuCategory.deleteMany"] = () => {
      throw new Error("db hiccup");
    };
    deleteOrganizationFiles.mockResolvedValue({ removed: 0, failures: ["stand-designs/org_1: storage down"] });

    const res = await executeAccountDeletion("org_1", "owner@x.com");

    expect(res).toMatchObject({ ok: true });
    if ("ok" in res) {
      expect(res.cleanupFailures).toHaveLength(2);
      expect(res.cleanupFailures.join(" ")).toMatch(/delete menu: db hiccup/);
      expect(res.cleanupFailures.join(" ")).toMatch(/storage down/);
    }
    // The remaining steps still ran after the failing one.
    expect(calls).toContain("staffAccount.deleteMany");
  });
});

describe("executeAccountDeletion — the email", () => {
  it("sends the closure email with the retention terms, to the confirming owner", async () => {
    await executeAccountDeletion("org_1", "owner@x.com");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("owner@x.com");
    expect(mail.subject).toMatch(/Harbour Kitchen/);
    expect(mail.text).toMatch(/5 years/);
    expect(mail.text).toMatch(/Australian tax law/);
    expect(mail.text).toMatch(/can't be undone/);
  });

  it("escapes the organisation name in the HTML body", async () => {
    results["organization.findUnique"] = { ...ORG, name: `<img src=x onerror=alert(1)> & Co` };
    await executeAccountDeletion("org_1", "owner@x.com");
    const html: string = sendEmail.mock.calls[0][0].html;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&amp; Co");
  });

  it("a failing email never turns a completed deletion into an error", async () => {
    sendEmail.mockResolvedValue({ ok: false, provider: "resend", test: false, error: "bounced" });
    expect(await executeAccountDeletion("org_1", "owner@x.com")).toMatchObject({ ok: true });
  });

  it("skips the email when there is no address to send to", async () => {
    await executeAccountDeletion("org_1", "");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
