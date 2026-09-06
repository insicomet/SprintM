import { describe, expect, it } from "vitest";
import { computeOpeningsArea_m2, computeOpeningsCost, DEFAULT_OPENINGS } from "./openings";

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

describe("computeOpeningsCost", () => {
  it("reproduces real project '22316': окна 30 м², дверь 1×2, ворота 4×4,2 -> 921 840 ₽", () => {
    const result = computeOpeningsCost({
      gatesCount: 1,
      gateWidth_m: 4,
      gateHeight_m: 4.2,
      doorsCount: 1,
      doorWidth_m: 1,
      doorHeight_m: 2,
      windowsArea_m2: 30,
    });
    expect(result.totalCost).toBeCloseTo(921840, 4);
  });

  it("reproduces real project '22318': без окон, дверь 1×2, двое ворот 3×3 -> 787 566 ₽", () => {
    const result = computeOpeningsCost({
      gatesCount: 2,
      gateWidth_m: 3,
      gateHeight_m: 3,
      doorsCount: 1,
      doorWidth_m: 1,
      doorHeight_m: 2,
      windowsArea_m2: 0,
    });
    expect(result.totalCost).toBeCloseTo(787566, 4);
  });

  it("prices gates and doors by area, like the source does", () => {
    const byName = Object.fromEntries(
      computeOpeningsCost(DEFAULT_OPENINGS).items.map((i) => [i.name, i]),
    );
    expect(byName["Ворота"].area_m2).toBeCloseTo(4 * 4.5, 9);
    expect(byName["Ворота"].unitPrice).toBe(40480);
    expect(byName["Двери"].unitPrice).toBe(29462.999999999996);
    expect(byName["Окна"].unitPrice).toBe(6094.999999999999);
  });

  it("costs nothing with no openings", () => {
    const result = computeOpeningsCost({
      gatesCount: 0,
      gateWidth_m: 0,
      gateHeight_m: 0,
      doorsCount: 0,
      doorWidth_m: 0,
      doorHeight_m: 0,
      windowsArea_m2: 0,
    });
    expect(result.totalCost).toBe(0);
  });
});
