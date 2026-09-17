// Verifies an ABN against the Australian Business Register — a real check
// that a venue is a registered business, replacing a phone number as the
// "prove you're real" mechanism (a phone doesn't prove anything about a
// business). Uses the ABR's free public ABN Lookup web service.
//
// Getting your own GUID (needed for real lookups): register (free) at
// https://abr.business.gov.au/Tools/WebServices — set it as ABR_GUID.
// Without one, this runs in mock mode (same pattern as Twilio/Resend
// elsewhere in this codebase): the ABN checksum is still validated for real,
// but the "registered entity" details are a clearly-labelled placeholder so
// the whole lookup -> confirm -> store flow is testable end to end.

const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

// The ABN check-digit algorithm (per the ABR spec): subtract 1 from the
// leading digit, weight every digit, and the sum must be divisible by 89.
export function isValidAbnChecksum(abn: string): boolean {
  const digits = abn.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const nums = digits.split("").map(Number);
  nums[0] -= 1;
  const sum = nums.reduce((acc, d, i) => acc + d * ABN_WEIGHTS[i], 0);
  return sum % 89 === 0;
}

export type AbnLookupResult =
  | {
      ok: true;
      abn: string;
      entityName: string;
      abnStatus: string;
      gstRegistered: boolean;
      test: boolean;
    }
  | { error: string };

export async function lookupAbn(rawAbn: string): Promise<AbnLookupResult> {
  const digits = rawAbn.replace(/\s+/g, "");
  if (!isValidAbnChecksum(digits)) {
    return { error: "That doesn't look like a valid ABN — check the digits." };
  }

  const guid = process.env.ABR_GUID?.trim();
  if (!guid) {
    return {
      ok: true,
      abn: digits,
      entityName: `Test Business ${digits.slice(-4)} Pty Ltd`,
      abnStatus: "Active",
      gstRegistered: true,
      test: true,
    };
  }

  try {
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${encodeURIComponent(digits)}&guid=${encodeURIComponent(guid)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { error: "The Australian Business Register isn't responding right now." };

    // The endpoint's default response is JSONP-shaped even without an
    // explicit callback param — strip a wrapping `callback(...)` if present.
    const text = await res.text();
    const jsonText = text.replace(/^\s*[A-Za-z0-9_]*\(/, "").replace(/\)\s*;?\s*$/, "");
    const data = JSON.parse(jsonText) as {
      Abn?: string;
      AbnStatus?: string;
      EntityName?: string;
      BusinessName?: string[];
      Gst?: string;
      Message?: string;
    };

    if (data.Message) return { error: data.Message };
    if (!data.Abn) return { error: "ABN not found on the Australian Business Register." };

    return {
      ok: true,
      abn: digits,
      entityName: data.EntityName || data.BusinessName?.[0] || "Registered entity",
      abnStatus: data.AbnStatus || "Unknown",
      gstRegistered: Boolean(data.Gst),
      test: false,
    };
  } catch {
    return { error: "Couldn't reach the Australian Business Register. Try again shortly." };
  }
}
