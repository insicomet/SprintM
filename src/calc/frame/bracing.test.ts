import { describe, expect, it } from "vitest";
import { computeBracing } from "./bracing";

const project22316 = {
  span_m: 18 as const,
  length_m: 30,
  height_m: 5,
  framePitch_m: 4.5,
  frameCount: 8,
  strutTube: "80х3" as const,
  extraTubeMass_t: 0.432,
  windowFramingPerimeter_m: 62,
};

const project22318 = {
  span_m: 15 as const,
  length_m: 24,
  height_m: 5,
  framePitch_m: 4,
  frameCount: 7,
  strutTube: "60х3" as const,
  extraTubeMass_t: 0.795,
};

function byName(result: ReturnType<typeof computeBracing>) {
  return Object.fromEntries(result.items.map((i) => [i.name, i]));
}

describe("computeBracing", () => {
  it("reproduces rows 96–98 of real project '22316'", () => {
    const items = byName(computeBracing(project22316));
    expect(items["Конструкции из труб"].mass_t).toBeCloseTo(3.1215465467132812, 9);
    expect(items["Уголок"].mass_t).toBeCloseTo(1.03896, 9);
    expect(items["Лист (фасонки)"].mass_t).toBeCloseTo(2.112, 9);
  });

  it("reproduces rows 96–98 of real project '22318'", () => {
    const items = byName(computeBracing(project22318));
    expect(items["Конструкции из труб"].mass_t).toBeCloseTo(2.4974476183208068, 9);
    expect(items["Уголок"].mass_t).toBeCloseTo(0.7215, 9);
    expect(items["Лист (фасонки)"].mass_t).toBeCloseTo(1.666, 9);
  });

  it("reproduces the money of '22316' to the kopeck", () => {
    const items = byName(computeBracing(project22316));
    expect(items["Конструкции из труб"].cost).toBeCloseTo(424686.4076803419, 4);
    expect(items["Уголок"].cost).toBeCloseTo(179220.6, 4);
    expect(items["Лист (фасонки)"].cost).toBeCloseTo(290970.24, 4);
    expect(computeBracing(project22316).totalCost).toBeCloseTo(
      424686.4076803419 + 179220.6 + 290970.24,
      4,
    );
  });

  it("reproduces the money of '22318' to the kopeck", () => {
    const items = byName(computeBracing(project22318));
    expect(items["Конструкции из труб"].cost).toBeCloseTo(339777.74847254576, 4);
    expect(items["Уголок"].cost).toBeCloseTo(124458.75, 4);
    expect(items["Лист (фасонки)"].cost).toBeCloseTo(229524.81999999998, 4);
  });

  it("takes the gusset weight from the section bank when it is given", () => {
    // 22316: строка банка 18м / k=0,8 / с/в 4/1 даёт 264 кг на раму.
    const result = computeBracing({ ...project22316, gussetMassPerFrame_kg: 264 });
    expect(byName(result)["Лист (фасонки)"].mass_t).toBeCloseTo(2.112, 9);
    // Другая строка банка — другая масса, и таблица по пролёту её не перебивает.
    const other = computeBracing({ ...project22316, gussetMassPerFrame_kg: 258 });
    expect(byName(other)["Лист (фасонки)"].mass_t).toBeCloseTo((8 * 258) / 1000, 9);
  });

  it("reports the section incomplete when there is no gusset weight at all", () => {
    const result = computeBracing({ ...project22316, span_m: 21, gussetMassPerFrame_kg: null });
    expect(byName(result)["Лист (фасонки)"].mass_t).toBeNull();
    expect(result.totalCost).toBeNull();
    expect(result.totalMass_kg).toBeNull();
    expect(result.missing).toContain("узловых пластин");
    // Остальные две строки при этом посчитаны.
    expect(byName(result)["Уголок"].cost).not.toBeNull();
  });

  it("the horizontal brace runs a quarter of the span across one bay", () => {
    // 22316: √(4,5² + 4,5²) = 6,3640; 22318: √(3,75² + 4²) = 5,4829
    const a = byName(computeBracing(project22316))["Конструкции из труб"].breakdown!;
    const horiz = a.find((p) => p.name === "Горизонтальные связи")!;
    expect(horiz.mass_t).toBeCloseTo(16 * Math.hypot(4.5, 4.5) * 0.0072 * 1.1, 12);
  });

  it("halves the horizontal-brace coefficient at spans of 12 m and under", () => {
    // Расчётчик (вопрос 02): «В расчётах 22316, 22318, 22285 пролёт больше
    // 12 м, соответственно мы не можем поделить горизонтальные связи на 2
    // по 6 м, а в расчётах 22326 и 22329 пролёт меньше 12 м, и поэтому
    // получается по 2 горизонтальные связи с каждой стороны». Подтверждено
    // на «22329» (Увильды, пролёт 12): коэффициент 4×2=8, не 8×2=16.
    const wide = byName(computeBracing({ ...project22316, span_m: 15 }))["Конструкции из труб"]
      .breakdown!.find((p) => p.name === "Горизонтальные связи")!;
    const narrow = byName(computeBracing({ ...project22316, span_m: 12 }))["Конструкции из труб"]
      .breakdown!.find((p) => p.name === "Горизонтальные связи")!;
    // При том же шаге рам разница — и коэффициент, и катет связи (см.
    // следующий тест): при пролёте ≤ 12 м катет тоже другой, пролёт/2.
    expect(wide.mass_t).toBeCloseTo(
      16 * Math.hypot(15 / 4, 4.5) * 0.0072 * 1.1,
      12,
    );
    expect(narrow.mass_t).toBeCloseTo(
      8 * Math.hypot(12 / 2, 4.5) * 0.0072 * 1.1,
      12,
    );
  });

  it("runs the horizontal brace span/2, not span/4, once the span drops to 12 m or under", () => {
    // Подтверждено раздельно на двух реальных проектах, где катет и шаг
    // рам не совпадают числом:
    //   «22285» (пролёт 18 > 12, шаг 4): L92 = √(4,5² + 4²) = 6,0208 —
    //     катет 4,5 = пролёт/4.
    //   «21987» (пролёт 12 ≤ 12, шаг 4,5): L92 = √(6² + 4,5²) = 7,5 —
    //     катет 6 = пролёт/2, а не пролёт/4 (3).
    const korkino = byName(
      computeBracing({ ...project22318, span_m: 18, framePitch_m: 4 }),
    )["Конструкции из труб"].breakdown!.find((p) => p.name === "Горизонтальные связи")!;
    expect(Math.hypot(18 / 4, 4)).toBeCloseTo(6.0207972893961475, 9);
    // Полный коэффициент 2×к(пролёт) = 2×8 = 16 при пролёте > 12 м.
    expect(korkino.mass_t).toBeCloseTo(16 * 6.0207972893961475 * 0.0072 * 1.1, 9);

    const cheboksary = byName(
      computeBracing({ ...project22318, span_m: 12, framePitch_m: 4.5 }),
    )["Конструкции из труб"].breakdown!.find((p) => p.name === "Горизонтальные связи")!;
    expect(Math.hypot(12 / 2, 4.5)).toBeCloseTo(7.5, 9);
    // Полный коэффициент 2×к(пролёт) = 2×4 = 8 при пролёте ≤ 12 м.
    expect(cheboksary.mass_t).toBeCloseTo(8 * 7.5 * 0.0072 * 1.1, 9);
  });

  it("leaves out the window framing when there are no windows", () => {
    const parts = byName(computeBracing(project22318))["Конструкции из труб"].breakdown!;
    expect(parts.some((p) => p.name.startsWith("Обрамление окон"))).toBe(false);
  });
});
