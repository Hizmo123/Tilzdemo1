import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, update, audit } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { organization: { findUnique, update } } }));
vi.mock("@/lib/audit", () => ({ audit }));

import { adminSuspendOrg, adminReactivateOrg, adminChangePlan } from "@/lib/admin/account-actions";

const active = { id: "org_1", plan: "BASIC", planStatus: "active", deactivatedAt: null, deletionExecutedAt: null };
const suspended = { ...active, planStatus: "suspended", deactivatedAt: new Date() };
const deleted = { ...active, planStatus: "deleted", deactivatedAt: new Date(), deletionExecutedAt: new Date() };

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset().mockResolvedValue({});
  audit.mockReset();
});

// An owner-deleted org has deactivatedAt set (that IS the login block), so it
// looks a lot like a suspended one. These pin the difference: it must never be
// suspended (which would overwrite planStatus "deleted" and break purge
// eligibility) or reactivated (which would revive an emptied shell).
describe("admin lifecycle actions refuse an owner-deleted organisation", () => {
  const REFUSAL = { error: expect.stringMatching(/deleted by its owner/) };

  it.each([
    ["adminSuspendOrg", () => adminSuspendOrg("org_1", "admin", "a@x.com")],
    ["adminReactivateOrg", () => adminReactivateOrg("org_1", "admin", "a@x.com")],
    ["adminChangePlan", () => adminChangePlan("org_1", "PRO", "admin", "a@x.com")],
  ])("%s", async (_name, run) => {
    findUnique.mockResolvedValue(deleted);
    expect(await run()).toMatchObject(REFUSAL);
    expect(update).not.toHaveBeenCalled(); // planStatus "deleted" is untouched
    expect(audit).not.toHaveBeenCalled();
  });

  it("also refuses when only deletionExecutedAt is set (planStatus drifted)", async () => {
    findUnique.mockResolvedValue({ ...active, deletionExecutedAt: new Date() });
    expect(await adminSuspendOrg("org_1", "admin", "a@x.com")).toMatchObject(REFUSAL);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("admin lifecycle actions still work for everything else", () => {
  it("suspends an active org", async () => {
    findUnique.mockResolvedValue(active);
    expect(await adminSuspendOrg("org_1", "admin", "a@x.com")).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ planStatus: "suspended", deactivatedByEmail: "a@x.com" }) }),
    );
  });

  it("reactivates a suspended org", async () => {
    findUnique.mockResolvedValue(suspended);
    expect(await adminReactivateOrg("org_1", "admin", "a@x.com")).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deactivatedAt: null, planStatus: "active" }) }),
    );
  });

  it("changes the plan of an active org", async () => {
    findUnique.mockResolvedValue(active);
    expect(await adminChangePlan("org_1", "PRO", "admin", "a@x.com")).toEqual({ ok: true });
  });

  it("still reports an unknown org", async () => {
    findUnique.mockResolvedValue(null);
    expect(await adminSuspendOrg("nope", "admin", "a@x.com")).toEqual({ error: "Organisation not found." });
  });
});
