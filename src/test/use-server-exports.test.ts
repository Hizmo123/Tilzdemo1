import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// A "use server" module may export ONLY async functions (types are erased, so
// they're fine). Exporting anything else — a const, a class, a sync function —
// makes Next reject the module at build/render time, and it has bitten this
// codebase repeatedly (a bucket-name constant, a confirmation literal). Shared
// values belong in a directive-free module, e.g. lib/supabase/service.ts or
// lib/admin/purge-confirmation.ts.
const ROOT = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(p);
  }
  return out;
}

const isUseServer = (src: string) =>
  /^\s*(\/\/.*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(src);

describe('"use server" files export only async functions', () => {
  it("finds no non-async value exports", () => {
    const offenders: string[] = [];

    for (const file of walk(ROOT)) {
      const src = readFileSync(file, "utf8");
      if (!isUseServer(src)) continue;

      for (const line of src.split(/\r?\n/)) {
        if (!/^export\s/.test(line)) continue;
        if (/^export\s+(type|interface)\b/.test(line)) continue; // erased at compile time
        if (/^export\s+async\s+function\b/.test(line)) continue;
        if (/^export\s+(const|let|var)\s+\w+[^=]*=\s*async\b/.test(line)) continue; // const fn = async () => …
        if (/^export\s*\{/.test(line) || /^export\s+\*/.test(line)) continue; // re-exports: not checkable here
        offenders.push(`${file.replace(ROOT, "src")}: ${line.trim().slice(0, 90)}`);
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
