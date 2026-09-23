import { describe, it, expect } from "vitest";
import { resolveStationServedTransition } from "@/lib/bills";

// Regression test for Phase 3.2: a multi-station order shares one
// Order.status — advanceOrderStatus used to let ANY single station's "Mark
// served" button flip the WHOLE order to SERVED, instantly removing it from
// getKitchenOrders for every OTHER station even if their items were never
// touched. resolveStationServedTransition is the pure gating decision:
// a multi-station order only actually reports "all served" once every
// station represented among its items has confirmed.
describe("resolveStationServedTransition", () => {
  it("a single-station order transitions immediately — unchanged original behavior", () => {
    const result = resolveStationServedTransition(["grill", "grill"], [], "grill");
    expect(result.allStationsServed).toBe(true);
  });

  it("an unlocked/expo board (no confirming station) always transitions immediately", () => {
    const result = resolveStationServedTransition(["grill", "bar"], [], null);
    expect(result.allStationsServed).toBe(true);
  });

  it("a two-station order does NOT complete when only one station confirms", () => {
    const result = resolveStationServedTransition(["grill", "bar"], [], "grill");
    expect(result.allStationsServed).toBe(false);
    expect(result.stationsServed).toEqual(["grill"]);
  });

  it("completes only once the second station also confirms", () => {
    const afterGrill = resolveStationServedTransition(["grill", "bar"], [], "grill");
    const afterBar = resolveStationServedTransition(["grill", "bar"], afterGrill.stationsServed, "bar");
    expect(afterBar.allStationsServed).toBe(true);
    expect(afterBar.stationsServed.sort()).toEqual(["bar", "grill"]);
  });

  it("a repeat confirmation from the same station doesn't double-count or falsely complete", () => {
    const result = resolveStationServedTransition(["grill", "bar", "bar"], ["grill"], "grill");
    expect(result.allStationsServed).toBe(false);
    expect(result.stationsServed).toEqual(["grill"]);
  });
});
