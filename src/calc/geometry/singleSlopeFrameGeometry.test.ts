import { describe, expect, it } from "vitest";
import {
  singleSlopeBeamLength_m,
  singleSlopeColumnLength_m,
  singleSlopeHighColumnHeight_m,
  singleSlopeRafterLength_m,
  singleSlopeRoofArea_m2,
} from "./singleSlopeFrameGeometry";

/**
 * «21851» (Бирск, 12×30×7,5, спринт СП односкат) — лист «1ск» того же
 * файла (эталонный пример 8×12×3, ТЗ 10256, 4 рамы) даёт живые числа,
 * сверенные здесь день в день.
 */
describe("singleSlopeFrameGeometry — «1ск» из «21851»", () => {
  const span_m = 8;
  const lowHeight_m = 3;
  const frameCount = 4;

  it("rafter length matches J16 exactly", () => {
    expect(singleSlopeRafterLength_m(span_m)).toBeCloseTo(8.12328619107409, 9);
  });

  it("high column height matches K16 exactly", () => {
    expect(singleSlopeHighColumnHeight_m(lowHeight_m, span_m)).toBeCloseTo(4.40988600322686, 9);
  });

  it("beam length matches C21 exactly", () => {
    expect(singleSlopeBeamLength_m(frameCount, span_m)).toBeCloseTo(64.98628952859272, 8);
  });

  it("column length matches C22 exactly", () => {
    const highHeight_m = singleSlopeHighColumnHeight_m(lowHeight_m, span_m);
    expect(singleSlopeColumnLength_m(frameCount, lowHeight_m, highHeight_m)).toBeCloseTo(
      67.27908802581487,
      8,
    );
  });

  it("roof area matches the real object's own ведомость (12×30, not the 8×12 «1ск» example)", () => {
    // Реальный объект «21851» сам по себе: пролёт 12, длина 30 — строка
    // «СП 200» на листе «18» даёт ровно 396 м².
    expect(singleSlopeRoofArea_m2(12, 30)).toBeCloseTo(396, 9);
  });
});
