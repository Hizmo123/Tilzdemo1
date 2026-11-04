import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("accepts same-origin paths", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/admin?x=1")).toBe("/admin?x=1");
  });
  it("falls back for missing or off-site values", () => {
    for (const bad of [undefined, null, "", "admin", "//evil.com", "/\\evil.com", "https://evil.com"]) {
      expect(safeNextPath(bad)).toBe("/dashboard");
    }
  });
});
