import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Regression guard for the Tillz -> Tap-to-It rebrand: nothing a user reads
// (page copy, dashboard/staff UI, emails, legal pages, downloadable
// filenames) should still say "Tillz" — new copy should pull from
// src/lib/brand.ts's BRAND instead of hardcoding a string, old or new.
//
// Scoped to src/app and src/components (not all of src/) and to comments
// stripped out before matching, because plenty of "Tillz" survives on
// purpose outside those: Prisma model/enum names (TillzStand,
// TILLZ_DEFAULT), the showTillzBranding entitlement flag, the TillzMark
// icon component, cookie/storage-key strings (tillz_staff,
// tillz_active_venue, tillz_dashboard_tour, tillz.kitchen.*, ...), and
// internal comments explaining behaviour rather than displaying text — see
// AGENTS.md's rebrand scope rule. ALLOWLISTED_SUBSTRINGS strips those
// specific identifiers before scanning so this test only catches text a
// person would actually see.
const ROOT = resolve(__dirname, "../..");
const SCAN_DIRS = ["src/app", "src/components"];

const ALLOWLISTED_SUBSTRINGS = [
  "TillzStand",
  "tillzStand",
  "tillzStands",
  "TillzMark",
  "showTillzBranding",
  "TILLZ_DEFAULT",
  "tillz_staff",
  "tillz_active_venue",
  "tillz_square_oauth_state",
  "tillz_square_oauth_flow",
  "tillz_dashboard_nav_collapsed",
  "tillz_dashboard_tour_autostarted",
  "tillz_dashboard_tour",
  "tillz_cart_",
  "tillz_intro_shown_",
  "tillz.kitchen.",
  "tillz.waiter.",
  "ordered_from_tillz",
  '"tillz"',
  "'tillz'",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.test\./.test(entry)) out.push(p);
  }
  return out;
}

// Strips // line comments and /* */ block comments. Not a real tokenizer
// (a "//" inside a string literal would be mishandled), but every current
// offender-shaped line in this codebase is plain prose, not a URL or regex
// containing "//" — good enough for a regression guard, not a parser.
function stripComments(src: string): string {
  // Normalise CRLF first — this repo's working-tree files are checked out
  // with \r\n, and a trailing \r would otherwise stop `$` from ever
  // matching end-of-line in the per-line replace below.
  return src
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("no leftover \"Tillz\" in user-facing source", () => {
  it("has no old-brand text outside the identifier/comment allowlist", () => {
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        let src = stripComments(readFileSync(file, "utf8"));
        for (const allowed of ALLOWLISTED_SUBSTRINGS) {
          src = src.split(allowed).join("");
        }
        if (/tillz|tilz/i.test(src)) {
          const lineNo = src.split("\n").findIndex((l) => /tillz|tilz/i.test(l)) + 1;
          offenders.push(`${file.replace(ROOT, ".")}:${lineNo}`);
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
