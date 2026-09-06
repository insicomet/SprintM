import { describe, expect, it } from "vitest";
import { findFrameSelection } from "../frame/sectionBank";
import { computeFrameTakeoff } from "./frameTakeoff";

describe("computeFrameTakeoff", () => {
  const geometry = {
    span_m: 12,
    length_m: 30,
    height_m: 3.6,
    framePitch_m: 6,
    roofSlopeDeg: 15,
  };

  it("computes a full takeoff for a fully-priced frame selection (12м, с/в=2/3, h=3.6, k=1.0)", () => {
    const selection = findFrameSelection({
      span: 12,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "2/3",
    });
    expect(selection).toBeDefined();

    const takeoff = computeFrameTakeoff(geometry, selection!);

    expect(takeoff.frameCount).toBe(6); // CEILING(30/6+1,1) = 6
    expect(takeoff.column.profileName).toBe("ПГС300/20х80х1,5");
    expect(takeoff.beam.profileName).toBe("ПГС300/20х80х2");

    // Длина: 6 рам × 2 колонны × (3,6 − 0,07) × 2 профиля в сечении
    expect(takeoff.column.totalLength_m).toBeCloseTo(6 * 2 * (3.6 - 0.07) * 2, 6);
    // Масса известна из прайс-листа -> не null
    expect(takeoff.column.massPerM_kg).not.toBeNull();
    expect(takeoff.beam.massPerM_kg).not.toBeNull();
    expect(takeoff.totalFrameMass_kg).not.toBeNull();
    expect(takeoff.totalFrameMass_kg!).toBeGreaterThan(0);
    expect(takeoff.column.priceSale_perM).not.toBeNull();
    expect(takeoff.totalFrameCost).not.toBeNull();
    expect(takeoff.totalFrameCost!).toBeGreaterThan(0);
    // Масса узловых пластин на здание = значение банка (на раму) * кол-во рам.
    expect(takeoff.gussetPlatesMass_kg).toBeCloseTo(selection!.massGussetPlates_kg! * 6, 6);
  });

  it("total mass equals the sum of column and beam mass", () => {
    const selection = findFrameSelection({
      span: 12,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "2/3",
    });
    const takeoff = computeFrameTakeoff(geometry, selection!);
    expect(takeoff.totalFrameMass_kg).toBeCloseTo(
      takeoff.column.totalMass_kg! + takeoff.beam.totalMass_kg!,
      9,
    );
  });

  it("all 23 profile names in the section bank resolve to a price (no remaining gaps)", () => {
    // После исправления сопоставления семейств (ПГС-сигма, не голое
    // "ПГС ...") все сечения из банка находят цену — раньше (до
    // исправления по замечанию пользователя 2026-09-04) 300х80х3мм
    // ошибочно считался отсутствующим в прайсе.
    const selection = findFrameSelection({
      span: 12,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "4/1",
    });
    const takeoff = computeFrameTakeoff(geometry, selection!);
    expect(takeoff.beam.profileName).toBe("ПГС300/20х80х3");
    expect(takeoff.beam.massPerM_kg).not.toBeNull();
    expect(takeoff.totalFrameMass_kg).not.toBeNull();
    expect(takeoff.totalFrameCost).not.toBeNull();
  });

  describe("reproduces the frame profile lengths of the two real projects", () => {
    // Сечение колонны и ригеля из двух профилей: в ведомости
    // балка = рам × длина_ригеля × 2, колонна = рам × 4 × (высота − 0,07).
    it("project '22316': пролёт 18, высота 5, 8 рам -> балка 298,15 и колонна 157,76 п.м.", () => {
      const selection = findFrameSelection({
        span: 18,
        height_m: 5,
        responsibility: 0.8,
        svCode: "4/1",
      })!;
      const takeoff = computeFrameTakeoff(
        { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, roofSlopeDeg: 15 },
        selection,
      );
      expect(takeoff.frameCount).toBe(8);
      expect(takeoff.beam.totalLength_m).toBeCloseTo(298.1489396563576, 6);
      expect(takeoff.column.totalLength_m).toBeCloseTo(157.76, 6);
    });

    it("project '22318': пролёт 15, высота 5, 7 рам -> балка 217,40 и колонна 138,04 п.м.", () => {
      const selection = findFrameSelection({
        span: 15,
        height_m: 5,
        responsibility: 1.0,
        svCode: "4/1",
      })!;
      const takeoff = computeFrameTakeoff(
        { span_m: 15, length_m: 24, height_m: 5, framePitch_m: 4, roofSlopeDeg: 15 },
        selection,
      );
      expect(takeoff.frameCount).toBe(7);
      expect(takeoff.beam.totalLength_m).toBeCloseTo(217.4002684994274, 6);
      expect(takeoff.column.totalLength_m).toBeCloseTo(138.04, 6);
    });
  });

  it("gracefully returns null mass (not a crash) for a profile name the price list genuinely has no match for", () => {
    const selection = findFrameSelection({
      span: 12,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "2/3",
    })!;
    const bogusSelection = { ...selection, beam: { ...selection.beam, profile: "ПГС999/20х999х9" } };

    const takeoff = computeFrameTakeoff(geometry, bogusSelection);
    expect(takeoff.beam.massPerM_kg).toBeNull();
    expect(takeoff.beam.totalMass_kg).toBeNull();
    expect(takeoff.totalFrameMass_kg).toBeNull();
    expect(takeoff.totalFrameCost).toBeNull();
    // Колонна при этом находится нормально.
    expect(takeoff.column.massPerM_kg).not.toBeNull();
  });
});
