import { describe, it, expect, vi, beforeEach } from "vitest";

const { getAuthz, executeAccountDeletion, audit, signOut } = vi.hoisted(() => ({
  getAuthz: vi.fn(),
  executeAccountDeletion: vi.fn(),
  audit: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthz }));
vi.mock("@/lib/account", () => ({ executeAccountDeletion }));
vi.mock("@/lib/audit", () => ({ audit }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut } }),
}));

import { deleteAccountAction } from "./privacy-actions";

const ORG = { id: "org_1", name: "Harbour Kitchen" };
const asRole = (role: string) =>
  getAuthz.mockResolvedValue({
    role,
    user: { id: "user_1", email: "owner@x.com" },
    membership: { organization: ORG },
  });

beforeEach(() => {
  getAuthz.mockReset();
  executeAccountDeletion.mockReset().mockResolvedValue({
    ok: true,
    orgName: ORG.name,
    retainedUntil: new Date("2031-09-28T00:00:00.000Z"),
    cleanupFailures: [],
  });
  audit.mockReset();
  signOut.mockReset().mockResolvedValue({});
});

// The disabled "Delete account" button in the UI is a convenience only — a
// server action can be invoked directly, so every gate is re-checked here.
describe("deleteAccountAction — the real gate", () => {
  it("does nothing without an organisation", async () => {
    getAuthz.mockResolvedValue({ role: "OWNER", user: { id: "u", email: "e" }, membership: null });
    expect(await deleteAccountAction("Harbour Kitchen")).toEqual({ error: "Not found." });
    expect(executeAccountDeletion).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "MANAGER", "STAFF", "KITCHEN", "VIEW_ONLY"])(
    "refuses a non-owner (%s) — even ADMIN, who otherwise holds settings:manage",
    async (role) => {
      asRole(role);
      expect(await deleteAccountAction("Harbour Kitchen")).toEqual({ error: "Only the owner can delete the account." });
      expect(executeAccountDeletion).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    },
  );

  it.each([["" ], ["harbour kitchen"], ["Harbour"], ["Harbour Kitchen 2"], ["  "]])(
    "refuses when the typed name is %j and deletes nothing",
    async (typed) => {
      asRole("OWNER");
      expect(await deleteAccountAction(typed)).toEqual({ error: "Type your venue's name exactly to confirm." });
      expect(executeAccountDeletion).not.toHaveBeenCalled();
      expect(audit).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    },
  );

  it("tolerates stray whitespace around an otherwise exact name", async () => {
    asRole("OWNER");
    expect(await deleteAccountAction("  Harbour Kitchen \n")).toEqual({ ok: true });
    expect(executeAccountDeletion).toHaveBeenCalledWith("org_1", "owner@x.com");
  });
});

describe("deleteAccountAction — success and failure paths", () => {
  it("on success: deletes, audits against the retained org, then signs THIS session out", async () => {
    asRole("OWNER");
    const order: string[] = [];
    executeAccountDeletion.mockImplementation(async () => {
      order.push("delete");
      return { ok: true, orgName: ORG.name, retainedUntil: new Date("2031-09-28T00:00:00.000Z"), cleanupFailures: ["x"] };
    });
    audit.mockImplementation(async () => void order.push("audit"));
    signOut.mockImplementation(async () => void order.push("signOut"));

    expect(await deleteAccountAction("Harbour Kitchen")).toEqual({ ok: true });

    expect(order).toEqual(["delete", "audit", "signOut"]);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        actorUserId: "user_1",
        action: "account.deleted",
        metadata: { retainedUntil: "2031-09-28T00:00:00.000Z", cleanupFailures: "1" },
      }),
    );
  });

  it("propagates a refusal (already deleted / suspended) without auditing or signing out", async () => {
    asRole("OWNER");
    executeAccountDeletion.mockResolvedValue({ error: "This account has already been deleted." });
    expect(await deleteAccountAction("Harbour Kitchen")).toEqual({ error: "This account has already been deleted." });
    expect(audit).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("still reports success if the sign-out itself throws — the account is already closed", async () => {
    asRole("OWNER");
    signOut.mockRejectedValue(new Error("network"));
    expect(await deleteAccountAction("Harbour Kitchen")).toEqual({ ok: true });
  });
});
