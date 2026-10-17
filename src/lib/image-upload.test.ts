import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { normalizeToJpeg, sniffDesignMime, isSafeSvg } from "./image-upload";

async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 20, height: 10, channels: 3, background: { r: 10, g: 200, b: 10 } },
  })
    .png()
    .toBuffer();
}

async function tinyJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 20, height: 10, channels: 3, background: { r: 10, g: 10, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

describe("normalizeToJpeg", () => {
  it("re-encodes a real PNG to a JPEG", async () => {
    const png = await tinyPng();
    const result = await normalizeToJpeg(png);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const meta = await sharp(result.buffer).metadata();
      expect(meta.format).toBe("jpeg");
    }
  });

  it("re-encodes a real JPEG to a JPEG", async () => {
    const jpeg = await tinyJpeg();
    const result = await normalizeToJpeg(jpeg);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const meta = await sharp(result.buffer).metadata();
      expect(meta.format).toBe("jpeg");
    }
  });

  it("rejects a non-image file masquerading as one (garbage bytes)", async () => {
    const garbage = Buffer.from("this is not an image, just plain text pretending to be one");
    const result = await normalizeToJpeg(garbage);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("That image couldn't be read. Try a different file.");
  });

  it("rejects an SVG — sharp can rasterise SVGs, but it's not one of the allowed source formats", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    const result = await normalizeToJpeg(svg);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Use a JPEG, PNG or WebP image.");
  });

  it("downscales an oversized image to fit within maxDimension", async () => {
    const big = await sharp({
      create: { width: 4000, height: 2000, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const result = await normalizeToJpeg(big, { maxDimension: 500 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const meta = await sharp(result.buffer).metadata();
      expect(meta.width).toBeLessThanOrEqual(500);
      expect(meta.height).toBeLessThanOrEqual(500);
    }
  });

  it("never enlarges an image smaller than maxDimension", async () => {
    const small = await tinyPng(); // 20x10
    const result = await normalizeToJpeg(small, { maxDimension: 2400 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const meta = await sharp(result.buffer).metadata();
      expect(meta.width).toBe(20);
      expect(meta.height).toBe(10);
    }
  });

  it("flattens transparency onto white rather than letting it turn black", async () => {
    const transparent = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const result = await normalizeToJpeg(transparent);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
      expect(info.channels).toBe(3); // JPEG has no alpha channel
      // Every pixel should be at/near white (255,255,255), not black.
      expect(data[0]).toBeGreaterThan(200);
    }
  });
});

describe("sniffDesignMime", () => {
  it("identifies a real PNG by magic bytes", async () => {
    expect(sniffDesignMime(await tinyPng())).toBe("image/png");
  });

  it("identifies a real JPEG by magic bytes", async () => {
    expect(sniffDesignMime(await tinyJpeg())).toBe("image/jpeg");
  });

  it("identifies a PDF by its %PDF- header", () => {
    const pdf = Buffer.from("%PDF-1.7\n%fake pdf content for testing\n");
    expect(sniffDesignMime(pdf)).toBe("application/pdf");
  });

  it("identifies a plain SVG", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffDesignMime(svg)).toBe("image/svg+xml");
  });

  it("identifies an SVG preceded by an XML declaration", () => {
    const svg = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffDesignMime(svg)).toBe("image/svg+xml");
  });

  it("identifies an SVG preceded by a UTF-8 BOM and whitespace", () => {
    const svg = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('   \n<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    ]);
    expect(sniffDesignMime(svg)).toBe("image/svg+xml");
  });

  it("returns null for a .jpg-renamed text file — the exact spoofing case this exists for", () => {
    const fakeJpeg = Buffer.from("just some text, renamed to look like a .jpg");
    expect(sniffDesignMime(fakeJpeg)).toBeNull();
  });

  it("returns null for an XML declaration with no actual <svg> element", () => {
    const xml = Buffer.from('<?xml version="1.0"?>\n<notAnSvg></notAnSvg>');
    expect(sniffDesignMime(xml)).toBeNull();
  });
});

describe("isSafeSvg", () => {
  it("allows a plain, scriptless SVG", () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red" /></svg>',
    );
    expect(isSafeSvg(svg)).toBe(true);
  });

  it("blocks an SVG containing a <script> tag", () => {
    const svg = Buffer.from('<svg><script>alert(document.cookie)</script></svg>');
    expect(isSafeSvg(svg)).toBe(false);
  });

  it("blocks an SVG containing <foreignObject> (HTML embedding)", () => {
    const svg = Buffer.from('<svg><foreignObject><body onload="x()"></body></foreignObject></svg>');
    expect(isSafeSvg(svg)).toBe(false);
  });

  it("blocks an SVG with an inline event-handler attribute", () => {
    const svg = Buffer.from('<svg onload="alert(1)"><rect width="1" height="1" /></svg>');
    expect(isSafeSvg(svg)).toBe(false);
  });

  it("blocks an SVG with a javascript: URI", () => {
    const svg = Buffer.from('<svg><a href="javascript:alert(1)">click</a></svg>');
    expect(isSafeSvg(svg)).toBe(false);
  });

  it("blocks an SVG over the 5MB cap", () => {
    const huge = Buffer.concat([
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><!--'),
      Buffer.alloc(5 * 1024 * 1024 + 10, "a"),
      Buffer.from("--></svg>"),
    ]);
    expect(isSafeSvg(huge)).toBe(false);
  });

  it("is case-insensitive — <SCRIPT> is blocked the same as <script>", () => {
    const svg = Buffer.from("<svg><SCRIPT>alert(1)</SCRIPT></svg>");
    expect(isSafeSvg(svg)).toBe(false);
  });
});
