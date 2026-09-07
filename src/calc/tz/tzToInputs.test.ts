import { describe, expect, it } from "vitest";
import { parseTz } from "./parseTz";
import { TZ_22326 } from "./tz22326.fixture";
import { tzToInputs } from "./tzToInputs";
import { computeOpeningsArea_m2, computeOpeningsDeduction_m2 } from "../geometry/openings";

describe("tzToInputs — ТЗ 22326", () => {
  const fill = tzToInputs(parseTz(TZ_22326));

  it("fills the object card from the brief", () => {
    expect(fill.city).toBe("Увильды");
    expect(fill.span).toBe(12);
    expect(fill.length_m).toBe(26);
    expect(fill.height_m).toBe(4);
    expect(fill.wallPanel_mm).toBe(150);
    expect(fill.roofPanel_mm).toBe(150);
    expect(fill.snowGuards).toBe(true);
  });

  it("turns the windows the right way up", () => {
    // В ТЗ «1х6м»; шестиметрового окна в четырёхметровом здании не бывает,
    // значит это лента 6 × 1. Тем более что и в реальных проектах окна
    // ленточные — 30 × 1 в «22316», 46 × 1 в «22285».
    expect(fill.openings.windowsCount).toBe(5);
    expect(fill.openings.windowHeight_m).toBe(1);
    expect(fill.adjustments.some((a) => a.includes("ленточные"))).toBe(true);
  });

  it("keeps the count and the area when it merges sizes", () => {
    // Окна 3×1 ×2, 3,5×1 ×1, 6×1 ×2 — площадь 21,5 м² на пять штук.
    expect(computeOpeningsArea_m2(fill.openings)).toBeCloseTo(21.5 + 2 * 1.3 * 2.1 + 2.5 * 2.5, 6);
    expect(fill.openings.windowsCount * fill.openings.windowWidth_m * fill.openings.windowHeight_m)
      .toBeCloseTo(21.5, 9);
    // Двери 1×2,1 и 1,6×2,1 → две штуки, площадь 5,46 м².
    expect(fill.openings.doorsCount).toBe(2);
    expect(fill.openings.doorsCount * fill.openings.doorWidth_m * fill.openings.doorHeight_m)
      .toBeCloseTo(5.46, 9);
  });

  it("owns up when the merge costs the wall deduction a metre", () => {
    // Поштучно вычет был бы 29 м²: окна 3+3+3+6+6 = 21, двери 2 + 2 = 4,
    // ворота 2×2 = 4. После сведения окон к 4,3 м ширины он падает до 20,
    // потому что вычет считается по округлённым вниз размерам. Один метр
    // — цена того, что приложение держит один размер на тип; молчать об
    // этом нельзя, поэтому расхождение попадает в список правок.
    expect(computeOpeningsDeduction_m2(fill.openings)).toBeCloseTo(4 + 4 + 20, 9);
    expect(fill.adjustments.some((a) => a.includes("20 м² вместо 21 м²"))).toBe(true);
  });

  it("lists what it had to merge", () => {
    expect(fill.adjustments.some((a) => a.startsWith("Окна:"))).toBe(true);
    expect(fill.adjustments.some((a) => a.startsWith("Двери:"))).toBe(true);
    // Ворота одного размера — сводить нечего.
    expect(fill.adjustments.some((a) => a.startsWith("Ворота:"))).toBe(false);
  });
});
