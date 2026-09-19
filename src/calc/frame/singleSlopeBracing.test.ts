import { describe, expect, it } from "vitest";
import { computeSingleSlopeBracing } from "./singleSlopeBracing";

/**
 * «21777» (12×36×4,5, спринт СП односкат, простой случай) — чистый
 * пример БЕЗ ручных отклонений: подтверждает формулу по умолчанию
 * (коэффициент вертикальных связей = 4, одно и то же плечо у
 * горизонтальных и вертикальных связей) день в день с реальной
 * ведомостью, до 9-го знака.
 */
describe("computeSingleSlopeBracing — «21777», формула по умолчанию", () => {
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
 * «21851» (12×30×7,5) использовал коэффициент 8 (не 4 по умолчанию) для
 * вертикальных связей — намеренно НЕ воспроизводится этим модулем один в
 * один (см. докстринг singleSlopeBracing.ts, «известные отклонения»):
 * это, по всем признакам, ручная особенность конкретного файла, а не
 * общее правило, и подтверждать код под неё значило бы закрепить
 * вероятную ошибку как норму.
 */
