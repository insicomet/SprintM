import { describe, expect, it } from "vitest";
import { computeRoofUnpricedItems, computeWallUnpricedItems } from "./unpricedItems";

const g22316 = { span_m: 18, length_m: 30, height_m: 5 };
const g22318 = { span_m: 15, length_m: 24, height_m: 5 };

function byName(s: ReturnType<typeof computeWallUnpricedItems>) {
  return Object.fromEntries(s.items.map((i) => [i.name, i]));
}

describe("computeWallUnpricedItems", () => {
  it("reproduces rows 108–110 of real project '22316'", () => {
    const items = byName(computeWallUnpricedItems(g22316));
    expect(items["ГВЛ"].count).toBeCloseTo(480, 9);
    expect(items["саморез 3,5х25"].count).toBeCloseTo(9600, 9);
    expect(items["ПС 50х50 (под гвл)"].count).toBeCloseTo(1700, 9);
  });

  it("reproduces rows 108–110 of real project '22318'", () => {
    const items = byName(computeWallUnpricedItems(g22318));
    expect(items["ГВЛ"].count).toBeCloseTo(390, 9);
    expect(items["саморез 3,5х25"].count).toBeCloseTo(7800, 9);
    expect(items["ПС 50х50 (под гвл)"].count).toBeCloseTo(1250, 9);
  });
});

describe("computeRoofUnpricedItems", () => {
  it("reproduces rows 137 and 143–145 of real project '22316'", () => {
    const items = byName(computeRoofUnpricedItems(g22316, 150, 780));
    expect(items["Утеплитель"].count).toBeCloseTo(86.4675, 6);
    expect(items["Линотерм"].count).toBeCloseTo(780, 9);
    expect(items["ИзоспанВ"].count).toBeCloseTo(675, 9);
    expect(items["Изоспан АМ"].count).toBeCloseTo(675, 9);
  });

  it("reproduces rows 137 and 143–145 of real project '22318'", () => {
    const items = byName(computeRoofUnpricedItems(g22318, 150, 480));
    expect(items["Утеплитель"].count).toBeCloseTo(57.834, 6);
    expect(items["Линотерм"].count).toBeCloseTo(480, 9);
    expect(items["ИзоспанВ"].count).toBeCloseTo(450, 9);
    expect(items["Изоспан АМ"].count).toBeCloseTo(450, 9);
  });

  it("scales the roof insulation with the panel thickness", () => {
    const thin = computeRoofUnpricedItems(g22316, 100, 780);
    const thick = computeRoofUnpricedItems(g22316, 200, 780);
    expect(byName(thick)["Утеплитель"].count).toBeCloseTo(
      2 * byName(thin)["Утеплитель"].count,
      9,
    );
  });

  it("reports what these lines would add to the estimator's total", () => {
    // Эти деньги в итог расчётчика сейчас не входят — ячейки стоимости пустые.
    expect(computeRoofUnpricedItems(g22316, 150, 780).wouldAddCost).toBeCloseTo(
      86.4675 * 3450 + 780 * 69 + 675 * 42 + 675 * 89.14,
      6,
    );
    expect(computeWallUnpricedItems(g22316).wouldAddCost).toBeGreaterThan(0);
  });
});
