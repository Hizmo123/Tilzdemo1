import { describe, it, expect } from "vitest";
import { removeStoragePrefix, deleteOrganizationFiles, type StorageLike } from "@/lib/account-storage";

// A fake bucket store: { "<bucket>": { "<prefix>/<file>": true, ... } } with
// the same semantics as Supabase's list()/remove() that matter here — list is
// capped by `limit`, folders come back with id === null, and remove() really
// removes (so re-listing shows the shrunken set).
function fakeClient(files: Record<string, string[]>, opts: { failList?: string; failRemove?: boolean } = {}) {
  const store: Record<string, Set<string>> = {};
  for (const [bucket, paths] of Object.entries(files)) store[bucket] = new Set(paths);
  const listCalls: { bucket: string; prefix: string | undefined }[] = [];
  const removeCalls: { bucket: string; paths: string[] }[] = [];

  const client: StorageLike = {
    storage: {
      from(bucket) {
        return {
          async list(prefix, options) {
            listCalls.push({ bucket, prefix });
            if (opts.failList === bucket) return { data: null, error: { message: "list boom" } };
            const p = `${prefix}/`;
            const entries = [...(store[bucket] ?? [])]
              .filter((path) => path.startsWith(p))
              .map((path) => path.slice(p.length))
              .map((rest) => (rest.includes("/") ? { name: rest.split("/")[0], id: null } : { name: rest, id: `id-${rest}` }));
            const unique = [...new Map(entries.map((e) => [e.name, e])).values()];
            return { data: unique.slice(0, options?.limit ?? 100), error: null };
          },
          async remove(paths) {
            removeCalls.push({ bucket, paths });
            if (opts.failRemove) return { error: { message: "remove boom" } };
            for (const path of paths) store[bucket]?.delete(path);
            return { error: null };
          },
        };
      },
    },
  };
  return { client, store, listCalls, removeCalls };
}

describe("removeStoragePrefix", () => {
  it("removes every file under the prefix, across more than one page", async () => {
    const many = Array.from({ length: 250 }, (_, i) => `rest_abc123/file-${i}.jpg`);
    const { client, store } = fakeClient({ "menu-images": [...many, "other_zzz999/keep.jpg"] });

    const { removed } = await removeStoragePrefix(client, "menu-images", "rest_abc123");

    expect(removed).toBe(250);
    expect([...store["menu-images"]]).toEqual(["other_zzz999/keep.jpg"]); // a different prefix is untouched
  });

  it("ignores sub-folders instead of looping forever on them", async () => {
    const { client, store } = fakeClient({ b: ["rest_abc123/a.png", "rest_abc123/nested/deep.png"] });
    const { removed } = await removeStoragePrefix(client, "b", "rest_abc123");
    expect(removed).toBe(1);
    expect(store.b.has("rest_abc123/nested/deep.png")).toBe(true);
  });

  it.each([["" ], ["."], [".."], ["a/b"], ["../other"], ["abc"], ["has space id1234"], ["x".repeat(65)]])(
    "refuses the unsafe prefix %j before listing anything (an empty/dotted prefix would walk the bucket root)",
    async (prefix) => {
      const { client, listCalls, removeCalls } = fakeClient({ b: ["rootfile.png"] });
      await expect(removeStoragePrefix(client, "b", prefix)).rejects.toThrow(/unsafe storage prefix/);
      expect(listCalls).toEqual([]);
      expect(removeCalls).toEqual([]);
    },
  );

  it("surfaces a listing error rather than silently reporting success", async () => {
    const { client } = fakeClient({ b: [] }, { failList: "b" });
    await expect(removeStoragePrefix(client, "b", "rest_abc123")).rejects.toThrow(/list boom/);
  });

  it("surfaces a removal error rather than silently reporting success", async () => {
    const { client } = fakeClient({ b: ["rest_abc123/a.png"] }, { failRemove: true });
    await expect(removeStoragePrefix(client, "b", "rest_abc123")).rejects.toThrow(/remove boom/);
  });
});

describe("deleteOrganizationFiles", () => {
  it("sweeps each restaurant's prefix in menu-images and the org's prefix in stand-designs, nothing else", async () => {
    const { client, store } = fakeClient({
      "menu-images": ["rest_one111/logo.jpg", "rest_two222/menu.jpg", "rest_other9/theirs.jpg"],
      "stand-designs": ["org_aaa1111/design.pdf", "org_bbb2222/theirs.pdf"],
    });

    const result = await deleteOrganizationFiles("org_aaa1111", ["rest_one111", "rest_two222"], client);

    expect(result).toEqual({ removed: 3, failures: [] });
    expect([...store["menu-images"]]).toEqual(["rest_other9/theirs.jpg"]);
    expect([...store["stand-designs"]]).toEqual(["org_bbb2222/theirs.pdf"]);
  });

  it("reports a failing target but still sweeps the others, and never throws", async () => {
    const { client, store } = fakeClient(
      { "menu-images": ["rest_one111/logo.jpg"], "stand-designs": ["org_aaa1111/design.pdf"] },
      { failList: "menu-images" },
    );

    const result = await deleteOrganizationFiles("org_aaa1111", ["rest_one111"], client);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatch(/list boom/);
    expect(result.removed).toBe(1);
    expect(store["stand-designs"].size).toBe(0);
  });
});
