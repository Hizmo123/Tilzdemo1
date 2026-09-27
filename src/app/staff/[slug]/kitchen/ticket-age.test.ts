import { describe, it, expect } from "vitest";
import { ageAccentClass, AGE_WARN_MINUTES, AGE_OVERDUE_MINUTES } from "./ticket-age";

describe("ageAccentClass", () => {
  it("is info while fresh, warn from the warn threshold, danger from the overdue threshold", () => {
    expect(ageAccentClass(0)).toBe("border-l-info");
    expect(ageAccentClass(AGE_WARN_MINUTES - 1)).toBe("border-l-info");
    expect(ageAccentClass(AGE_WARN_MINUTES)).toBe("border-l-warn");
    expect(ageAccentClass(AGE_OVERDUE_MINUTES - 1)).toBe("border-l-warn");
    expect(ageAccentClass(AGE_OVERDUE_MINUTES)).toBe("border-l-danger");
  });

  it("stays neutral once a ticket is no longer being worked, however old", () => {
    expect(ageAccentClass(999, false)).toBe("border-l-line-strong");
  });
});
