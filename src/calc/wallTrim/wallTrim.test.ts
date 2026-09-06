import { describe, expect, it } from "vitest";
import { computeWallTrim } from "./wallTrim";

/** Реальный проект "22316": 18×30, высота 5. */
const project22316 = { span_m: 18, length_m: 30, height_m: 5 };
/** Реальный проект "22318": 15×24, высота 5. */
const project22318 = { span_m: 15, length_m: 24, height_m: 5 };

function byName(takeoff: ReturnType<typeof computeWallTrim>) {
  return Object.fromEntries(takeoff.items.map((i) => [i.name, i]));
}

describe("computeWallTrim", () => {
  it("reproduces every quantity and cost of real project '22316'", () => {
    const items = byName(computeWallTrim(project22316));
    expect(items["У.115 внутренний (2м)"].count).toBeCloseTo(66.31578947368422, 9);
    expect(items["У.115 внутренний (2м)"].cost).toBeCloseTo(53052.631578947, 6);
    expect(items["У.115 наружный (2м)"].count).toBeCloseTo(10.526315789473685, 9);
    expect(items["У.115 наружный (2м)"].cost).toBeCloseTo(8421.052631578, 6);
  });

  it("reproduces the section total of '22316' (F44)", () => {
    const result = computeWallTrim(project22316);
    expect(result.totalCost).toBeCloseTo(62703.15789473685, 6);
    expect(result.totalMass_kg).toBeCloseTo(83.89473684210527, 9);
  });

  it("reproduces the section total of '22318' (F44)", () => {
    const result = computeWallTrim(project22318);
    expect(result.totalCost).toBeCloseTo(52395.78947368421, 6);
    expect(result.totalMass_kg).toBeCloseTo(72.5263157894737, 9);
  });

  it("scales the inner angle with the building outline and the outer one with height", () => {
    const taller = byName(computeWallTrim({ ...project22316, height_m: 10 }));
    const base = byName(computeWallTrim(project22316));
    // Наружный зависит только от высоты...
    expect(taller["У.115 наружный (2м)"].count).toBeCloseTo(
      2 * base["У.115 наружный (2м)"].count,
      9,
    );
    // ...внутренний от неё не зависит вовсе.
    expect(taller["У.115 внутренний (2м)"].count).toBeCloseTo(
      base["У.115 внутренний (2м)"].count,
      9,
    );
  });

  it("applies the 2% overhead on top of the item subtotal", () => {
    const result = computeWallTrim(project22316);
    expect(result.overheadCost).toBeCloseTo(result.subtotalCost * 0.02, 9);
    expect(result.totalCost).toBeCloseTo(result.subtotalCost + result.overheadCost, 9);
  });
});
