import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// Regression guard for a bug `next build` cannot see: a Server Component (or
// any module without "use client") that CALLS a non-component export of a
// "use client" module. Under the RSC bundler that import is a client
// reference, and invoking it at render time throws "Attempted to call … from
// the server but it is on the client" — build and typecheck both pass, and it
// only blows up when someone opens the page (this shipped once as the kitchen
// "Pass" view crash: pass-view.tsx called ageAccentClass() from
// kitchen-ticket.tsx).
//
// Heuristic, not a full RSC analysis: flags any non-type named import whose
// name isn't a PascalCase component (so functions, hooks and ALL_CAPS
// constants are all flagged) coming from a "use client" file into a file that
// has no "use client" directive itself.
// If this ever flags something that is genuinely only used inside client
// trees, move the value into a directive-free module (see
// kitchen/ticket-age.ts) rather than weakening the test.
const ROOT = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.test\./.test(entry)) out.push(p);
  }
  return out;
}

function directiveOf(src: string): string | null {
  const stripped = src.replace(/^\s*(\/\/.*\n|\/\*[\s\S]*?\*\/\s*)*/g, "");
  const m = stripped.match(/^["']([^"']+)["']/);
  return m ? m[1] : null;
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(ROOT, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

describe("server modules never call into 'use client' modules", () => {
  it("has no non-component imports from a client module into a non-client file", () => {
    const files = walk(ROOT);
    const directives = new Map(files.map((f) => [resolve(f), directiveOf(readFileSync(f, "utf8"))]));

    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (directiveOf(src) === "use client") continue;
      for (const m of src.matchAll(/import\s+(?!type\b)\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
        const target = resolveImport(f, m[2]);
        if (!target || directives.get(resolve(target)) !== "use client") continue;
        const names = m[1]
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("type "))
          .map((s) => s.split(/\s+as\s+/)[0].trim());
        // A component is PascalCase: starts uppercase AND has a lowercase
        // letter. ALL_CAPS names (NEXT_LABEL, AGE_WARN_MINUTES…) are constants
        // — just as unusable from a server module as a function is.
        const values = names.filter((n) => !/^[A-Z].*[a-z]/.test(n));
        if (values.length) offenders.push(`${f.replace(ROOT, "src")} imports ${values.join(", ")} from a "use client" module (${target.replace(ROOT, "src")})`);
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
