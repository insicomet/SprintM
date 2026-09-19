import { describe, expect, it } from "vitest";
import { computeSingleSlopeBracing } from "./singleSlopeBracing";

/**
 * «21851» (Бирск, 12×30×7,5, спринт СП односкат, простой случай — два
 * столбца, без центральной опоры) — живые числа сверены день в день с
 * листом «18» реальной ведомости.
 */
describe("computeSingleSlopeBracing — «21851»", () => {
  const base = {
    span_m: 12,
    length_m: 30,
    lowHeight_m: 7.5,
    framePitch_m: 4.5,
    frameCount: 8,
    strutCount: 4,
    verticalBraceLeg_m: 4,
    extraTubeMass_t: 0.811,
    gussetMassPerFrame_t: 0.29,
    windowFramingPerimeter_m: 66,
  };

  it("«Конструкции из труб» matches C97 exactly", () => {
    const result = computeSingleSlopeBracing(base);
    const tubes = result.items.find((i) => i.name === "Конструкции из труб");
    expect(tubes?.mass_t).toBeCloseTo(3.8227454469348436, 9);
  });

  it("«Уголок» matches C98 exactly", () => {
    const result = computeSingleSlopeBracing(base);
    const angle = result.items.find((i) => i.name === "Уголок");
    expect(angle?.mass_t).toBeCloseTo(0.939393, 6);
  });

  it("«Лист (фасонки)» matches C99 exactly", () => {
    const result = computeSingleSlopeBracing(base);
    const plate = result.items.find((i) => i.name === "Лист (фасонки)");
    expect(plate?.mass_t).toBeCloseTo(2.32, 9);
  });

  it("total mass is the sum of all three lines", () => {
    const result = computeSingleSlopeBracing(base);
    expect(result.totalMass_kg).toBeCloseTo((3.8227454469348436 + 0.939393 + 2.32) * 1000, 3);
  });
});
