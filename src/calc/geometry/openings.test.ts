import { describe, expect, it } from "vitest";
import {
  computeOpeningsArea_m2,
  computeOpeningsCost,
  DEFAULT_OPENINGS,
  windowFramingPerimeter_m,
  computeOpeningsDeduction_m2,
  type OpeningsInput,
} from "./openings";

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
      windowsCount: 0,
      windowWidth_m: 0,
      windowHeight_m: 0,
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
      windowsCount: 1,
        windowWidth_m: 30,
        windowHeight_m: 1,
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
      windowsCount: 0,
      windowWidth_m: 0,
      windowHeight_m: 0,
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
      windowsCount: 0,
      windowWidth_m: 0,
      windowHeight_m: 0,
    });
    expect(result.totalCost).toBe(0);
  });
});

describe("windowFramingPerimeter_m", () => {
  it("rounds the window up to the frame pitch, per the estimator's confirmed rule", () => {
    // «22316»: окно 30 м при шаге 4,5. Расчётчик подтвердила, что 30 в
    // самом файле — ошибка: «Там ошибка, обрамление должно быть 31,5м»
    // (7 шагов × 4,5). Раньше мы брали 30 как есть, чтобы файл сходился
    // до копейки; теперь считаем по правилу и с файлом на этой строке
    // расходимся намеренно — см. buildBill.test.ts.
    expect(
      windowFramingPerimeter_m(
        { ...DEFAULT_OPENINGS, windowsCount: 1, windowWidth_m: 30, windowHeight_m: 1 },
        4.5,
      ),
    ).toBeCloseTo(2 * (31.5 + 1) * 1, 9);
  });

  it("matches L156 of '22318'/'22285' where the file's own rounding is already correct", () => {
    // Окно 46 м при шаге 4 → 48 м (12 шагов). В этих двух файлах
    // расчётчик уже вписала верное округлённое число, поэтому здесь
    // правило и факт совпадают.
    expect(
      windowFramingPerimeter_m(
        { ...DEFAULT_OPENINGS, windowsCount: 1, windowWidth_m: 46, windowHeight_m: 1 },
        4,
      ),
    ).toBeCloseTo(2 * (48 + 1) * 1, 9);
  });

  it("never rounds below one full frame pitch, even for a window narrower than the pitch", () => {
    // Окно у́же шага (4,3 м при шаге 6 м) всё равно требует обрамления
    // на целый шаг — стойки стоят по рамам, а не по краю окна.
    expect(
      windowFramingPerimeter_m(
        { ...DEFAULT_OPENINGS, windowsCount: 5, windowWidth_m: 4.3, windowHeight_m: 1 },
        6,
      ),
    ).toBeCloseTo(2 * (6 + 1) * 5, 9);
  });

  it("is zero without windows ('22318')", () => {
    expect(windowFramingPerimeter_m(DEFAULT_OPENINGS, 4)).toBe(0);
  });
});

describe("computeOpeningsDeduction_m2", () => {
  /**
   * Из площади стен вычитаются размеры, округлённые ВНИЗ до целых
   * метров — и ширина, и высота. Правило подтверждено расчётчиком;
   * до этого разница читалась как описка в "22316".
   */
  it("reproduces the deduction written into «22316» (C102)", () => {
    // −1×30×1 − 2×1×1 − 4×4×1 = 48 м², при фактических 48,8 м²
    const o: OpeningsInput = {
      gatesCount: 1, gateWidth_m: 4, gateHeight_m: 4.2,
      doorsCount: 1, doorWidth_m: 1, doorHeight_m: 2,
      windowsCount: 1, windowWidth_m: 30, windowHeight_m: 1,
    };
    expect(computeOpeningsDeduction_m2(o)).toBeCloseTo(48, 9);
    expect(computeOpeningsArea_m2(o)).toBeCloseTo(48.8, 9);
  });

  it("reproduces «22318», where every size is whole anyway", () => {
    // −3×3×2 − 1×2×1 = 20 м², и вычет равен фактической площади
    const o: OpeningsInput = {
      gatesCount: 2, gateWidth_m: 3, gateHeight_m: 3,
      doorsCount: 1, doorWidth_m: 1, doorHeight_m: 2,
      windowsCount: 0, windowWidth_m: 0, windowHeight_m: 0,
    };
    expect(computeOpeningsDeduction_m2(o)).toBeCloseTo(20, 9);
    expect(computeOpeningsArea_m2(o)).toBeCloseTo(20, 9);
  });

  it("rounds the width down too, not just the height", () => {
    const o: OpeningsInput = {
      gatesCount: 1, gateWidth_m: 3.5, gateHeight_m: 4.2,
      doorsCount: 0, doorWidth_m: 0, doorHeight_m: 0,
      windowsCount: 0, windowWidth_m: 0, windowHeight_m: 0,
    };
    expect(computeOpeningsDeduction_m2(o)).toBeCloseTo(12, 9); // 3 × 4
  });

  it("does not lose a whole metre to floating point", () => {
    const o: OpeningsInput = {
      gatesCount: 1, gateWidth_m: 0.1 + 0.2 + 2.7, gateHeight_m: 3,
      doorsCount: 0, doorWidth_m: 0, doorHeight_m: 0,
      windowsCount: 0, windowWidth_m: 0, windowHeight_m: 0,
    };
    // 0,1 + 0,2 + 2,7 = 2,9999999999999996 — но это три метра, не два.
    expect(computeOpeningsDeduction_m2(o)).toBeCloseTo(9, 9);
  });
});
