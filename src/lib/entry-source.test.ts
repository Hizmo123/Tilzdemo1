import { describe, it, expect } from "vitest";
import { parseEntrySource } from "@/lib/entry-source";

describe("parseEntrySource", () => {
  it("nfc -> nfc", () => {
    expect(parseEntrySource("nfc")).toBe("nfc");
  });

  it("qr -> qr", () => {
    expect(parseEntrySource("qr")).toBe("qr");
  });

  it("missing (undefined) -> qr", () => {
    expect(parseEntrySource(undefined)).toBe("qr");
  });

  it("missing (null) -> qr", () => {
    expect(parseEntrySource(null)).toBe("qr");
  });

  it("empty string -> qr", () => {
    expect(parseEntrySource("")).toBe("qr");
  });

  it("garbage -> qr", () => {
    expect(parseEntrySource("bluetooth")).toBe("qr");
  });

  it("wrong case is garbage, not a case-insensitive match -> qr", () => {
    expect(parseEntrySource("NFC")).toBe("qr");
  });

  it("a repeated ?src= query key (array) uses the first value", () => {
    expect(parseEntrySource(["nfc", "qr"])).toBe("nfc");
    expect(parseEntrySource(["bogus", "nfc"])).toBe("qr");
  });
});
