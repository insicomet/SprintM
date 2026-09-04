import { describe, expect, it } from "vitest";
import { computeOpeningsArea_m2, DEFAULT_OPENINGS } from "./openings";

describe("computeOpeningsArea_m2", () => {
  it("sums gates, doors and windows area", () => {
    const area = computeOpeningsArea_m2(DEFAULT_OPENINGS);
    // 1 gate 4x4.5 + 1 door 1x2.1 + 0 windows
    expect(area).toBeCloseTo(4 * 4.5 + 1 * 2.1, 6);
  });

  it("is zero with no openings", () => {
    const area = computeOpeningsArea_m2({
      gatesCount: 0,
      gateWidth_m: 0,
      gateHeight_m: 0,
      doorsCount: 0,
      doorWidth_m: 0,
      doorHeight_m: 0,
      windowsArea_m2: 0,
    });
    expect(area).toBe(0);
  });
});
