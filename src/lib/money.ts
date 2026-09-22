// All monetary amounts in Tillz are integer minor units (cents). Never floats
// (spec §65, §106). Formatting is currency-aware via Intl so we don't hardcode
// "$" anywhere (spec §76).

// Accepts bigint too — Square's SDK types Money.amount as bigint (see
// src/lib/square/pay.ts), and mixing bigint with a plain number in `/ 100`
// throws ("Cannot mix BigInt and other types") rather than formatting
// anything. Number(cents) is safe here: every real amount is well under
// Number.MAX_SAFE_INTEGER.
export function formatCents(cents: number | bigint, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(Number(cents) / 100);
}

// Parse a user-entered dollar string ("24", "24.5", "$24.50") into integer
// cents. Returns null on anything invalid. Used for menu price entry.
export function dollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  // Avoid float drift: split on the decimal and assemble cents as integers.
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}
