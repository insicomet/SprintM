import { describe, expect, it } from "vitest";
import {
  singleSlopeBeamLength_m,
  singleSlopeColumnLength_m,
  singleSlopeRafterLength_m,
  singleSlopeRoofArea_m2,
} from "./singleSlopeFrameGeometry";

/**
 * Сверка на реальных объектах, лист «18» (рабочий лист, не оторванный от
 * практики шаблон «1ск» — см. докстринг singleSlopeFrameGeometry.ts).
 */
describe("singleSlopeFrameGeometry — реальные объекты", () => {
  it("rafter length matches J16 exactly on «21851» (span 12)", () => {
    expect(singleSlopeRafterLength_m(12)).toBeCloseTo(12.422872485681566, 9);
  });

  it("rafter length matches J16 exactly on «22295» (span 8)", () => {
    expect(singleSlopeRafterLength_m(8)).toBeCloseTo(8.281914990454377, 9);
  });

  it("beam length matches C21 exactly on «21777» (span 12, 7 frames)", () => {
    expect(singleSlopeBeamLength_m(7, 12)).toBeCloseTo(173.92021479954192, 8);
  });

  it("beam length matches C21 exactly on «22236» (span 8,5, 10 frames)", () => {
    expect(singleSlopeBeamLength_m(10, 8.5)).toBeCloseTo(175.99069354715553, 8);
  });

  it("column length matches C22 exactly on «21851» (8 frames, 7,5/9,3)", () => {
    expect(singleSlopeColumnLength_m(8, 7.5, 9.3)).toBeCloseTo(268.8, 9);
  });

  it("column length matches C22 exactly on «22236» (10 frames, 4/6)", () => {
    expect(singleSlopeColumnLength_m(10, 4, 6)).toBeCloseTo(200, 9);
  });

  it("roof area matches the real object's own ведомость: «21851» (12×30 → 396)", () => {
    expect(singleSlopeRoofArea_m2(12, 30)).toBeCloseTo(396, 9);
  });

  it("roof area matches the real object's own ведомость: «22236» (8,5×50 → 467,5)", () => {
    expect(singleSlopeRoofArea_m2(8.5, 50)).toBeCloseTo(467.5, 9);
  });
});
