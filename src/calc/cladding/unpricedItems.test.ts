import { describe, expect, it } from "vitest";
import {
  computeMezzanineItems,
  computeRoofUnpricedItems,
  computeWallUnpricedItems,
} from "./unpricedItems";

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

describe("computeMezzanineItems", () => {
  it("reproduces rows 46–51 and 127–132 of real project '22316'", () => {
    const i = byName(computeMezzanineItems(g22316, 8));
    expect(i["ПГС-S 300х80х3"].count).toBeCloseTo(288, 9);
    expect(i["ПГС-S 300х80х1,5"].count).toBeCloseTo(390, 9);
    expect(i["ПГС-S 300х80х2"].count).toBeCloseTo(60, 9);
    expect(i["С-44 0,7 оц"].count).toBeCloseTo(594, 9);
    expect(i["Фс11, Фс14"].count).toBeCloseTo(290, 9);
    expect(i["Фс12"].count).toBeCloseTo(580, 9);
    expect(i["Утепление"].count).toBeCloseTo(113.4, 6);
    expect(i["Изоспан В"].count).toBeCloseTo(1296, 9);
    expect(i["ГВЛ"].count).toBeCloseTo(1620, 9);
    expect(i["Саморез 3,5x32(45)"].count).toBeCloseTo(48600, 9);
    expect(i["Саморез 4,8x20"].count).toBeCloseTo(4752, 9);
    expect(i["Саморез 5,5x25"].count).toBeCloseTo(10800, 9);
  });

  it("reproduces rows 46–51 and 127–132 of real project '22318'", () => {
    const i = byName(computeMezzanineItems(g22318, 7));
    expect(i["ПГС-S 300х80х3"].count).toBeCloseTo(210, 9);
    expect(i["ПГС-S 300х80х1,5"].count).toBeCloseTo(264, 9);
    expect(i["ПГС-S 300х80х2"].count).toBeCloseTo(50, 9);
    expect(i["С-44 0,7 оц"].count).toBeCloseTo(396, 6);
    expect(i["Фс11, Фс14"].count).toBeCloseTo(216.66666666666669, 6);
    expect(i["Фс12"].count).toBeCloseTo(433.33333333333337, 6);
    expect(i["Утепление"].count).toBeCloseTo(75.6, 6);
    expect(i["Изоспан В"].count).toBeCloseTo(864, 9);
    expect(i["ГВЛ"].count).toBeCloseTo(1080, 9);
    expect(i["Саморез 5,5x25"].count).toBeCloseTo(7200, 9);
  });

  it("leaves the insulation unpriced, exactly as the bill does", () => {
    const i = byName(computeMezzanineItems(g22316, 8));
    expect(i["Утепление"].unitPrice).toBe(0);
    expect(i["Утепление"].wouldCost).toBe(0);
  });
});
