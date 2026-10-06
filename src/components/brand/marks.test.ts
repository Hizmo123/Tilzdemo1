import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import * as marks from "./marks";

describe("marks.tsx exports", () => {
  it("exports the four spec'd marks", () => {
    expect(typeof marks.BrandMark).toBe("function");
    expect(typeof marks.TapRippleMark).toBe("function");
    expect(typeof marks.ScanFrameMark).toBe("function");
    expect(typeof marks.DoneMark).toBe("function");
  });

  it("keeps TillzMark as a deprecated alias of BrandMark, not a separate component", () => {
    expect(marks.TillzMark).toBe(marks.BrandMark);
  });
});

// Regression guard: nothing new should start importing the deprecated
// TillzMark alias — it exists only so code that hadn't migrated yet (at the
// time of the logo-system task) keeps working. Scoped to an actual `import
// { ... TillzMark ... } from ".../brand/marks"` statement, not a bare text
// match — payments-step.tsx has its OWN unrelated local `TillzMark`
// function (a generic card icon, nothing to do with the brand mark) that a
// plain text search would wrongly flag.
const ROOT = resolve(__dirname, "../../..");
const SCAN_DIRS = ["src/app", "src/components"];
const IMPORT_PATTERN = /import\s*\{[^}]*\bTillzMark\b[^}]*\}\s*from\s*["'][^"']*brand\/marks["']/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.test\./.test(entry)) out.push(p);
  }
  return out;
}

describe("no new TillzMark imports outside the alias file", () => {
  it("only marks.tsx itself defines TillzMark — nothing else imports it from brand/marks", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        if (file === __filename.replace(/\.test\.ts$/, ".tsx")) continue; // marks.tsx itself
        const src = readFileSync(file, "utf8");
        if (IMPORT_PATTERN.test(src)) offenders.push(file.replace(ROOT, "."));
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
