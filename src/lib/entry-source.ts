// How a guest reached their table's ordering page: tapped an NFC tag, or
// scanned the printed QR. Stand QR codes are never reprinted for this (see
// lib/stands.ts#resolveStand's own comment on why standUrl never embeds
// anything beyond the qrToken) — NFC tags are instead written with the
// SAME /s/<qrToken> URL plus ?src=nfc, so the one physical stand can serve
// both a QR panel and an NFC chip without two different codes to print or
// two different resolution paths to maintain.
export type EntrySource = "nfc" | "qr";

const VALID: readonly EntrySource[] = ["nfc", "qr"];

// Anything other than exactly "nfc" is "qr" — missing, "QR"/"Nfc" (case
// matters, deliberately: the tag is written with the lowercase literal, so
// a mismatched case is closer to "garbage" than "intentional nfc"),
// "garbage", or an array (a repeated ?src= query key) all fall through to
// the same safe default rather than erroring.
export function parseEntrySource(value: string | string[] | null | undefined): EntrySource {
  const v = Array.isArray(value) ? value[0] : value;
  return (VALID as readonly string[]).includes(v ?? "") ? (v as EntrySource) : "qr";
}
