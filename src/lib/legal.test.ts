import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { LEGAL } from "@/lib/legal";
import TermsPage from "@/app/terms/page";
import PrivacyPage from "@/app/privacy/page";

// Guard tests for the real Terms/Privacy install (replacing the old
// placeholder pages). Deliberately does NOT assert on LEGAL.address — the
// task that installed these pages explicitly said not to.
describe("legal pages — install guard", () => {
  it("LEGAL.abn is the real ABN", () => {
    expect(LEGAL.abn).toBe("93 236 439 291");
  });

  it("TermsPage renders without throwing", () => {
    expect(() => renderToStaticMarkup(TermsPage())).not.toThrow();
  });

  it("PrivacyPage renders without throwing", () => {
    expect(() => renderToStaticMarkup(PrivacyPage())).not.toThrow();
  });
});

// Regression guard: neither page should ever regress back to the old
// placeholder content (brand name typo, TODO markers, "this isn't binding"
// disclaimers) once the real reviewed text is installed.
const ROOT = resolve(__dirname, "../..");
const BANNED: RegExp[] = [/Tillz/i, /TODO/, /placeholder/i, /not binding/i];

describe("legal pages — no stale placeholder markers", () => {
  it.each([
    ["src/app/terms/page.tsx"],
    ["src/app/privacy/page.tsx"],
  ])("%s contains none of Tillz/TODO/placeholder/not binding", (relPath) => {
    const src = readFileSync(resolve(ROOT, relPath), "utf8");
    const hits = BANNED.filter((re) => re.test(src));
    expect(hits, hits.map(String).join(", ")).toEqual([]);
  });
});
