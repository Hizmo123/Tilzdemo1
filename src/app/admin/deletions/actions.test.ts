import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePlatformAdmin, purgeDeletedOrganization, revalidatePath } = vi.hoisted(() => ({
  requirePlatformAdmin: vi.fn(),
  purgeDeletedOrganization: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/platform-admin", () => ({ requirePlatformAdmin }));
vi.mock("@/lib/admin/account-purge", () => ({ purgeDeletedOrganization }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { purgeDeletedOrgAction } from "./actions";

const COUNTS = { bills: 4, payments: 3 };

beforeEach(() => {
  requirePlatformAdmin.mockReset().mockResolvedValue({ userId: "admin_1" });
  purgeDeletedOrganization.mockReset().mockResolvedValue({ ok: true, counts: COUNTS });
  revalidatePath.mockReset();
});

// The button being disabled until "DELETE" is typed is a convenience; this
// action can be invoked directly, so every gate is re-checked here.
describe("purgeDeletedOrgAction — the real gate", () => {
  it("checks platform-admin FIRST and purges nothing if that redirects/throws", async () => {
    requirePlatformAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(purgeDeletedOrgAction("org_1", "DELETE")).rejects.toThrow("NEXT_REDIRECT");
    expect(purgeDeletedOrganization).not.toHaveBeenCalled();
  });

  it.each([[""], ["delete"], ["Delete"], [" DELETE"], ["DELETE "], ["DELET"], ["DELETEE"], ["yes"]])(
    "refuses the confirmation %j (exact, case-sensitive) and purges nothing",
    async (typed) => {
      const res = await purgeDeletedOrgAction("org_1", typed);
      expect(res).toEqual({ error: "Type DELETE exactly (capitals) to confirm." });
      expect(purgeDeletedOrganization).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("purges with the admin's own id when DELETE is typed, and refreshes the admin views", async () => {
    const res = await purgeDeletedOrgAction("org_1", "DELETE");
    expect(res).toEqual({ ok: true, counts: COUNTS });
    expect(purgeDeletedOrganization).toHaveBeenCalledWith("org_1", "admin_1");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/deletions");
  });

  it("surfaces the purge's own refusal (e.g. still inside retention) and does not revalidate as if it worked", async () => {
    purgeDeletedOrganization.mockResolvedValue({ error: "Records must be retained until 1 January 2099." });
    expect(await purgeDeletedOrgAction("org_1", "DELETE")).toEqual({ error: "Records must be retained until 1 January 2099." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
