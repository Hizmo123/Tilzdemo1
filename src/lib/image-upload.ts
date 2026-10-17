import sharp from "sharp";

// The browser-supplied File.type on an upload is whatever the client claims
// it is — trivially spoofable (rename a .html/.svg-with-script to .jpg, or
// just edit the multipart field by hand) and never a safe signal on its
// own. Everything here re-derives the REAL format from the file's own
// bytes instead of trusting that header.

export type NormalizeResult = { ok: true; buffer: Buffer } | { ok: false; error: string };

// Re-encodes any real JPEG/PNG/WebP into a fixed-quality JPEG, capped to
// maxDimension on its longest side — the same shape every photo upload in
// this app needs (menu items, venue logo/cover, stand product images), so
// it lives here once instead of four near-identical sharp pipelines. sharp
// itself is what actually proves the format: it parses the real image
// structure, not the claimed MIME type, so a renamed non-image file (or a
// genuinely corrupt one) fails here rather than being written to storage
// as a ".jpg" that isn't one.
export async function normalizeToJpeg(
  buf: Buffer,
  { maxDimension = 2400 }: { maxDimension?: number } = {},
): Promise<NormalizeResult> {
  try {
    // limitInputPixels caps decoded size against a decompression-bomb (a
    // tiny file that expands to a huge pixel grid); failOn:"error" stops on
    // the first structural problem instead of sharp's default of pressing
    // on through a malformed file.
    const image = sharp(buf, { limitInputPixels: 50_000_000, failOn: "error" });
    const metadata = await image.metadata();

    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
      return { ok: false, error: "Use a JPEG, PNG or WebP image." };
    }

    const buffer = await image
      .rotate() // applies EXIF orientation, then strips it — never a sideways re-upload.
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      // Flattens any transparency onto white before JPEG encoding, which has
      // no alpha channel of its own — without this, a transparent PNG/WebP's
      // alpha silently turns black once re-encoded.
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    return { ok: true, buffer };
  } catch {
    // Anything from a non-image file, a truncated/corrupt one, or a pixel
    // count over the limit above throws here — one message for all of it,
    // never the underlying sharp error (which can echo back file-path-ish
    // detail that doesn't belong in a user-facing string).
    return { ok: false, error: "That image couldn't be read. Try a different file." };
  }
}

// Magic-byte sniffing for the stand-design upload, which (unlike every
// photo upload above) has to accept non-image formats too (PDF, SVG) and
// can't just re-encode a print-ready file through sharp without degrading
// it. Returns null for anything that doesn't match one of the accepted
// signatures — never a best guess.
export function sniffDesignMime(
  buf: Buffer,
): "image/png" | "image/jpeg" | "application/pdf" | "image/svg+xml" | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    return "application/pdf";
  }
  if (isSvgSignature(buf)) {
    return "image/svg+xml";
  }
  return null;
}

// SVG has no fixed magic bytes — it's XML text, possibly preceded by a BOM
// or an XML/doctype declaration before the actual <svg> element appears.
// Only looks at the first 4KB: a real SVG's root element always opens near
// the top of the file, so anything legitimate is found well within that,
// and capping the scan keeps a multi-megabyte non-SVG file from being
// fully decoded as text just to answer "is this SVG".
function isSvgSignature(buf: Buffer): boolean {
  let text = buf.subarray(0, 4096).toString("utf8");
  // Strip a UTF-8 BOM if present, then leading whitespace, before checking
  // what the content actually starts with.
  text = text.replace(/^﻿/, "").trimStart();
  if (text.startsWith("<svg")) return true;
  if (/^<\?xml|^<!doctype svg/i.test(text)) {
    return /<svg[\s>]/i.test(text);
  }
  return false;
}

const UNSAFE_SVG_PATTERN =
  /<script|<foreignobject|<iframe|<embed|<object|<audio|<video|<animate|<set\b|javascript:|data:text\/html|\son[a-z]+\s*=/;

const MAX_SVG_BYTES = 5 * 1024 * 1024;

// An SVG is XML, and XML can carry <script>, event handler attributes, or
// an embedded HTML document — none of which belong in what's supposed to
// be a static vector image heading to a public bucket. This is a blocklist
// over the raw text, not a sanitiser: anything it doesn't recognise as
// unsafe is allowed through unchanged, so it only ever REJECTS a file,
// never rewrites one. Lowercased first so the pattern doesn't need its own
// case-insensitive flag (and can't be defeated by e.g. <SCRIPT>).
export function isSafeSvg(buf: Buffer): boolean {
  if (buf.length > MAX_SVG_BYTES) return false;
  const text = buf.toString("utf8").toLowerCase();
  return !UNSAFE_SVG_PATTERN.test(text);
}
