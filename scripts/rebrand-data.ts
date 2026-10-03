// One-off: rebrand "Tillz" -> "Tap-to-It" in platform-owned DB content.
//
// Scope: StandProduct.title / StandProduct.description — the admin-managed
// stand catalog a venue orders from (there's no seed file for this; rows are
// created through /admin/products). Plan/addon copy lives in src/lib/plans.ts
// (static TS, already rebranded) — there's no Plan/Addon DB model to touch.
//
// Deliberately NOT touched: StandOrder.productTitleSnapshot (and any other
// *Snapshot column) — those record what a venue actually bought at order
// time and must keep reading exactly what the receipt said, not be rewritten
// after the fact. Also not touched: anything under Restaurant/MenuItem/etc
// — that's venue-owned content, not ours to rebrand.
//
// Idempotent: matches are case-insensitive and only rows that still contain
// "tillz"/"tilz" get touched, so re-running after a successful --apply finds
// nothing left to do.
//
// Usage:
//   npx tsx scripts/rebrand-data.ts            (dry run, default — prints the plan, writes nothing)
//   npx tsx scripts/rebrand-data.ts --apply     (writes the changes)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

const REPLACEMENTS: [RegExp, string][] = [
  [/tillz/gi, "Tap-to-It"],
  [/tilz/gi, "Tap-to-It"],
];

function rebrand(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function containsOldBrand(text: string | null): boolean {
  return !!text && /tillz|tilz/i.test(text);
}

async function main() {
  const products = await prisma.standProduct.findMany({
    where: {
      OR: [
        { title: { contains: "tillz", mode: "insensitive" } },
        { title: { contains: "tilz", mode: "insensitive" } },
        { description: { contains: "tillz", mode: "insensitive" } },
        { description: { contains: "tilz", mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, description: true },
  });

  if (products.length === 0) {
    console.log("No StandProduct rows contain \"Tillz\"/\"Tilz\". Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${products.length} StandProduct row(s) to update:\n`);

  for (const p of products) {
    const newTitle = rebrand(p.title);
    const newDescription = rebrand(p.description);

    if (containsOldBrand(p.title)) {
      console.log(`  [${p.id}] title:`);
      console.log(`    - ${p.title}`);
      console.log(`    + ${newTitle}`);
    }
    if (containsOldBrand(p.description)) {
      console.log(`  [${p.id}] description:`);
      console.log(`    - ${p.description}`);
      console.log(`    + ${newDescription}`);
    }

    if (APPLY) {
      await prisma.standProduct.update({
        where: { id: p.id },
        data: { title: newTitle, description: newDescription },
      });
    }
  }

  console.log(
    APPLY
      ? "\nDone — rows updated."
      : "\nDry run only — no rows were changed. Re-run with --apply to write these changes.",
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
