import { describe, expect, it } from "vitest";
import { computeSingleSlopeBracing } from "./singleSlopeBracing";

/**
 * «21777» (12×36×4,5) — низкая высота (4,5) МЕНЬШЕ катета (пролёт/2=6),
 * поэтому коэффициент вертикальных связей = 4. Чистый случай без
 * отклонений катета.
 */
describe("computeSingleSlopeBracing — «21777» (низкий случай, коэфф. верт. связей 4)", () => {
  const base = {
    span_m: 12,
    length_m: 36,
    lowHeight_m: 4.5,
    framePitch_m: 6,
    frameCount: 7,
    strutCount: 4,
    extraTubeMass_t: 2.45,
    gussetMassPerFrame_t: 0.29,
  };

  it("«Конструкции из труб» matches C97 exactly", () => {
    const result = computeSingleSlopeBracing(base);
    const tubes = result.items.find((i) => i.name === "Конструкции из труб");
    expect(tubes?.mass_t).toBeCloseTo(4.845925903250806, 9);
  });

  it("«Уголок» matches C98 exactly", () => {
    const result = computeSingleSlopeBracing(base);
    const angle = result.items.find((i) => i.name === "Уголок");
    expect(angle?.mass_t).toBeCloseTo(0.7828275, 6);
  });

  it("«Лист (фасонки)» matches C99 exactly", () => {
    const result = computeSingleSlopeBracing(base);
    const plate = result.items.find((i) => i.name === "Лист (фасонки)");
    expect(plate?.mass_t).toBeCloseTo(2.03, 9);
  });
});

/**
 * «22295» (8×24×8) — низкая высота (8) БОЛЬШЕ катета (пролёт/2=4),
 * поэтому коэффициент вертикальных связей = 8. Подтверждает, что
 * коэффициент выводится из соотношения высоты и катета, а не является
 * ручным выбором расчётчика.
 */
describe("computeSingleSlopeBracing — «22295» (высокий узкий случай, коэфф. верт. связей 8)", () => {
  it("«Конструкции из труб» matches C97 exactly", () => {
    const result = computeSingleSlopeBracing({
      span_m: 8,
      length_m: 24,
      lowHeight_m: 8,
      framePitch_m: 6,
      frameCount: 5,
      strutCount: 2,
      extraTubeMass_t: 0.368,
      gussetMassPerFrame_t: 0.29,
      windowFramingPerimeter_m: 20,
    });
    const tubes = result.items.find((i) => i.name === "Конструкции из труб");
    expect(tubes?.mass_t).toBeCloseTo(2.505099819208141, 9);
  });
});

/**
 * «22236» (8,5×50×4) — низкая высота (4) чуть МЕНЬШЕ катета
 * (пролёт/2=4,25, разница 0,25 м) → коэффициент вертикальных связей = 4.
 * Проверяет границу правила «высота ≥ катет» на тесном случае. Катет
 * вертикальных связей в реальном объекте отличался (5, не 4,25) — это
 * известное отклонение (см. докстринг), поэтому передаём override.
 */
describe("computeSingleSlopeBracing — «22236» (граничный случай, override катета)", () => {
  it("«Конструкции из труб» matches C97 exactly with the historical leg override", () => {
    const result = computeSingleSlopeBracing({
      span_m: 8.5,
      length_m: 50,
      lowHeight_m: 4,
      framePitch_m: 5.56,
      frameCount: 10,
      strutCount: 4,
      verticalBraceLeg_m: 5,
      extraTubeMass_t: 0.735,
      gussetMassPerFrame_t: 0.29,
    });
    const tubes = result.items.find((i) => i.name === "Конструкции из труб");
    expect(tubes?.mass_t).toBeCloseTo(3.331835418097459, 9);
  });
});

/**
 * «21851» (12×30×7,5) — катет вертикальных связей в реальном объекте
 * был голым числом 4 (не пролёт/2=6) — известное отклонение (см.
 * докстринг singleSlopeBracing.ts). Коэффициент (8, т.к. высота 7,5 ≥
 * катет 6) при этом совпадает с правилом без override.
 */
describe("computeSingleSlopeBracing — «21851» (override катета вертикальных связей)", () => {
  it("«Конструкции из труб» matches C97 exactly with the historical leg override", () => {
    const result = computeSingleSlopeBracing({
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
    });
    const tubes = result.items.find((i) => i.name === "Конструкции из труб");
    expect(tubes?.mass_t).toBeCloseTo(3.8227454469348436, 9);
  });
});
