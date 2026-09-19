// Normalise a phone number to E.164 for storage/display as a plain contact
// field. Defaults to Australian numbers, but accepts anything already in
// +<country> form.
//
//   0412 345 678   -> +61412345678
//   0412345678     -> +61412345678
//   +61412345678   -> +61412345678
//   61412345678    -> +61412345678
export function normalizeAuPhone(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  // Already international.
  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = raw.replace(/\D/g, "");

  // Local AU mobile/landline starting 0 -> +61 and drop the leading 0.
  if (digits.startsWith("0") && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }
  // Already has the 61 country code without +.
  if (digits.startsWith("61") && digits.length === 11) {
    return `+${digits}`;
  }
  return null;
}

// Mask for display / logs: +61412345678 -> +61 4•• ••• 678
export function maskPhone(e164: string): string {
  if (e164.length < 6) return e164;
  return `${e164.slice(0, 4)}•••${e164.slice(-3)}`;
}
