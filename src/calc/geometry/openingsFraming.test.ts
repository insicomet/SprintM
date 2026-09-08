import { describe, expect, it } from "vitest";
import { computeOpeningsFraming } from "./openingsFraming";

/**
 * Эталон — ячейка вывод!E68 пересчитанных книг подборщика. В ведомости
 * это слагаемое, вписанное расчётчиком в C96 с округлением до трёх
 * знаков: 0,432 и 0,795.
 */
describe("computeOpeningsFraming", () => {
  it("reproduces «22316» — 1 ворота 4 м, 1 дверь, шаг 4,5", () => {
    const m = computeOpeningsFraming({
      gates: [{ count: 1, width_m: 4, height_m: 4.5 }],
      doorsCount: 1,
      framePitch_m: 4.5,
      hasWindows: false,
    });
    expect(m.gates_kg).toBeCloseTo(367.5, 6);
    expect(m.doors_kg).toBeCloseTo(64.26, 6);
    expect(m.total_t).toBeCloseTo(0.43176, 9);
    expect(m.complete).toBe(true);
  });

  it("reproduces «22318» — 2 ворот 3 м, 1 дверь, шаг 4", () => {
    const m = computeOpeningsFraming({
      gates: [{ count: 2, width_m: 3, height_m: 3 }],
      doorsCount: 1,
      framePitch_m: 4,
      hasWindows: false,
    });
    expect(m.total_t).toBeCloseTo(0.79548, 9);
  });

  it("reproduces the two invented projects that have no windows", () => {
    // B · Курган — 2 ворот 3,5 м, 1 дверь, шаг 6 → вывод!E68 = 0,81060
    expect(
      computeOpeningsFraming({
        gates: [{ count: 2, width_m: 3.5, height_m: 3.5 }],
        doorsCount: 1,
        framePitch_m: 6,
        hasWindows: false,
      }).total_t,
    ).toBeCloseTo(0.8106, 9);
    // D · Омск — 1 ворота 4 м, 1 дверь, шаг 6 → вывод!E68 = 0,44310
    expect(
      computeOpeningsFraming({
        gates: [{ count: 1, width_m: 4, height_m: 4 }],
        doorsCount: 1,
        framePitch_m: 6,
        hasWindows: false,
      }).total_t,
    ).toBeCloseTo(0.4431, 9);
  });

  it("counts a gate wider than 6 m at 450 kg instead of 350", () => {
    const wide = computeOpeningsFraming({
      gates: [{ count: 1, width_m: 6.5, height_m: 5 }],
      doorsCount: 0,
      framePitch_m: 4,
      hasWindows: false,
    });
    expect(wide.gates_kg).toBeCloseTo(450 * 1.05, 9);
    // Ровно 6 м — ещё «до 6 м».
    expect(
      computeOpeningsFraming({
        gates: [{ count: 1, width_m: 6, height_m: 5 }],
        doorsCount: 0,
        framePitch_m: 4,
        hasWindows: false,
      }).gates_kg,
    ).toBeCloseTo(350 * 1.05, 9);
  });

  it("classifies mixed gate sizes each on their own — the estimator's own 'add a slot'", () => {
    // Одни ворота обычные (350), другие широкие (450) — раньше такое
    // сводилось в один усреднённый размер, теперь это два слота, и у
    // каждого своя классификация «до/свыше 6 м» (Лист1!O23 и O24 —
    // ровно две строки исходника под этот случай).
    const m = computeOpeningsFraming({
      gates: [
        { count: 1, width_m: 4, height_m: 4.5 },
        { count: 1, width_m: 6.5, height_m: 5 },
      ],
      doorsCount: 0,
      framePitch_m: 4,
      hasWindows: false,
    });
    expect(m.gates_kg).toBeCloseTo((350 + 450) * 1.05, 9);
  });

  it("says the sum is short when the project has windows", () => {
    // A · Тюмень: ворота и двери дают 0,84084 т, а подборщик показывает
    // 1,41164 — разницу набирает ленточное окно, которого мы не считаем.
    const m = computeOpeningsFraming({
      gates: [{ count: 2, width_m: 4, height_m: 4.2 }],
      doorsCount: 2,
      framePitch_m: 3,
      hasWindows: true,
    });
    expect(m.total_t).toBeCloseTo(0.84084, 9);
    expect(m.complete).toBe(false);
  });
});
