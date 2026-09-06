import { describe, expect, it } from "vitest";
import {
  insulationThicknessForRoofing,
  purlinFamilyForRoofing,
  purlinLinesPerSlope,
  roofLoadForDecking_kPa,
  selectPurlin,
} from "./selectPurlin";
import { maxPurlinStepByDecking } from "./deckingSpan";
import type { PurlinSelectionInput } from "./types";

/**
 * Оба реальных проекта. Числа снятые из подборщиков:
 *   "22316" — вывод!D23=2150, D28=1800, 'Подбор прогонов 2'!V28=3174,6
 *   "22318" — вывод!D23=1900, D28=1900, 'Подбор прогонов 2'!V28=1699,2
 */
const project22316: PurlinSelectionInput = {
  span_m: 18,
  framePitch_m: 4.5,
  snowLoad_kPa: 1.5,
  roofingSelfWeight_kg_m2: 32.028,
  roofSlopeDeg: 15,
  gammaN: 1,
  maxStep_mm: 2150,
  snowGuardPurlin: true,
  family: "2ПС",
};

const project22318: PurlinSelectionInput = {
  span_m: 15,
  framePitch_m: 4,
  snowLoad_kPa: 1.8,
  roofingSelfWeight_kg_m2: 32.028,
  roofSlopeDeg: 15,
  gammaN: 1,
  maxStep_mm: 1900,
  snowGuardPurlin: false,
  family: "2ПС",
};

describe("maxPurlinStepByDecking", () => {
  it("reproduces «Макс шаг прогонов» of both real projects", () => {
    // вывод!E23 = 'Подбор прогонов'!B13 × 1,15
    const load22316 = roofLoadForDecking_kPa(1.5, 15);
    expect(load22316).toBeCloseTo(2.431288658727748, 9);
    expect(maxPurlinStepByDecking("С44-1000-0,7", load22316 * 1.15)).toBe(2150);

    const load22318 = roofLoadForDecking_kPa(1.8, 15);
    expect(load22318).toBeCloseTo(2.877546390473298, 9);
    expect(maxPurlinStepByDecking("С44-1000-0,7", load22318 * 1.15)).toBe(1900);
  });

  it("reads the sandwich-panel columns too", () => {
    // С-П 150 держит больше, чем профнастил С44-1000-0,7 — шаг выходит крупнее.
    expect(maxPurlinStepByDecking("с-п 150", roofLoadForDecking_kPa(1.5, 15) * 1.15)).toBe(2450);
  });

  it("returns null for an unknown decking mark", () => {
    expect(maxPurlinStepByDecking("нет такой марки", 2)).toBeNull();
  });
});

describe("selectPurlin", () => {
  it("reproduces real project '22316': МП350, 2ПС 200х65х1,5, шаг 1800", () => {
    const result = selectPurlin(project22316, 30);
    expect(result).not.toBeNull();
    expect(result!.profile.name).toBe("2ПС 200х65х1,5");
    expect(result!.profile.series).toBe("МП350");
    expect(result!.step_mm).toBe(1800);
    expect(result!.massPerBay_kg).toBeCloseTo(476.19, 6);
    expect(result!.massPerBuilding_kg).toBeCloseTo(3174.6, 6);
  });

  it("reproduces real project '22318': МП390, 2ПС 195х45х1,5, шаг 1900", () => {
    const result = selectPurlin(project22318, 24);
    expect(result).not.toBeNull();
    expect(result!.profile.name).toBe("2ПС 195х45х1,5");
    expect(result!.profile.series).toBe("МП390");
    expect(result!.step_mm).toBe(1900);
    expect(result!.massPerBay_kg).toBeCloseTo(283.2, 6);
    expect(result!.massPerBuilding_kg).toBeCloseTo(1699.2, 6);
    // Вариант МП350 тяжелее — он и проигрывает.
    expect(result!.runnerUp!.profile.name).toBe("2ПС 200х65х1,5");
    expect(result!.runnerUp!.massPerBay_kg).toBeCloseTo(325.6, 6);
  });

  it("keeps МП350 when the two series weigh the same ('22316')", () => {
    const result = selectPurlin(project22316, 30);
    // В "22316" обе серии дают одну и ту же массу, но разный шаг:
    // МП350 — 1800, МП390 — 2125. Исходник сравнивает строго (>), поэтому 350.
    expect(result!.runnerUp!.profile.series).toBe("МП390");
    expect(result!.runnerUp!.step_mm).toBe(2125);
    expect(result!.runnerUp!.massPerBay_kg).toBeCloseTo(result!.massPerBay_kg, 6);
  });

  it("never exceeds the maximum step", () => {
    const result = selectPurlin({ ...project22316, maxStep_mm: 1200 }, 30);
    expect(result!.step_mm).toBeLessThanOrEqual(1200);
  });

  it("returns null when nothing passes at any allowed step", () => {
    // Огромная нагрузка при большом шаге рам — ни один профиль не проходит.
    expect(selectPurlin({ ...project22316, snowLoad_kPa: 30, framePitch_m: 12 }, 30)).toBeNull();
  });
});

describe("purlinLinesPerSlope", () => {
  it("adds half a line per slope for the snow-guard purlin", () => {
    expect(purlinLinesPerSlope(18, 1800, { snowGuardPurlin: false })).toBe(6);
    expect(purlinLinesPerSlope(18, 1800, { snowGuardPurlin: true })).toBe(6.5);
    expect(purlinLinesPerSlope(18, 1800, { snowGuardPurlin: true, railingPurlin: true })).toBe(7);
  });

  it("counts by the horizontal half-span, not by the rafter length", () => {
    // 15/2 = 7,5 м; 7,5/1,9 = 3,95 → 4 линии + 1 = 5 на скат ("22318").
    expect(purlinLinesPerSlope(15, 1900, { snowGuardPurlin: false })).toBe(5);
  });
});

describe("purlinFamilyForRoofing", () => {
  it("uses 2ТПС under the layered «наше» roof and 2ПС under everything else", () => {
    expect(purlinFamilyForRoofing("наше 200 мм с 1 слоем гвл")).toBe("2ТПС");
    expect(purlinFamilyForRoofing("С-П 150")).toBe("2ПС");
    expect(purlinFamilyForRoofing("профлист")).toBe("2ПС");
  });

  it("reads the insulation thickness out of the «наше» roof name", () => {
    expect(insulationThicknessForRoofing("наше 150 мм с 2 слоем гвл")).toBe(150);
    expect(insulationThicknessForRoofing("наше 250 мм")).toBe(250);
    // Для "наше 100 мм" исходник фильтр не включает (B18 возвращает 0).
    expect(insulationThicknessForRoofing("наше 100 мм")).toBe(0);
    expect(insulationThicknessForRoofing("С-П 150")).toBe(0);
  });
});
