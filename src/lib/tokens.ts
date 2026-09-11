import { randomBytes } from "crypto";

// URL-safe alphabet with visually ambiguous characters removed (no 0/O/o, 1/l/I).
// Keeps printed QR fallbacks and any manual entry unambiguous.
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

// Generate an opaque visit token. 10 chars over a 55-symbol alphabet is ~58 bits
// of entropy — ample to be unguessable while staying short enough to print.
export function generateToken(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
