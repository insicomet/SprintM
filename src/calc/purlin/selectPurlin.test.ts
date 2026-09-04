import { describe, expect, it } from "vitest";
import { selectPurlin } from "./selectPurlin";

const baseInput = {
  roofLoad_kPa: 2.3,
  framePitch_m: 6,
  minStep_mm: 500,
  maxStep_mm: 3000,
};

describe("selectPurlin", () => {
  it("returns a result for a typical load/pitch combination", () => {
    const result = selectPurlin(baseInput);
    expect(result).toBeDefined();
    expect(result!.step_mm).toBeGreaterThanOrEqual(baseInput.minStep_mm);
    expect(result!.step_mm).toBeLessThanOrEqual(baseInput.maxStep_mm);
  });

  it("caps the step at maxStep_mm even if the profile could span further", () => {
    const result = selectPurlin({ ...baseInput, roofLoad_kPa: 0.5, maxStep_mm: 800 });
    expect(result).toBeDefined();
    expect(result!.step_mm).toBe(800);
    expect(result!.maxCapableStep_mm).toBeGreaterThan(800);
  });

  it("returns undefined when even the lightest step is not enough for the load", () => {
    // Экстремально высокая нагрузка + большой пролёт — ни один профиль не выдержит минимальный шаг.
    const result = selectPurlin({ ...baseInput, roofLoad_kPa: 500, framePitch_m: 12 });
    expect(result).toBeUndefined();
  });

  it("a heavier load forces a smaller accepted step for the same profile family", () => {
    const light = selectPurlin({ ...baseInput, roofLoad_kPa: 1.0, maxStep_mm: 5000 });
    const heavy = selectPurlin({ ...baseInput, roofLoad_kPa: 4.0, maxStep_mm: 5000 });
    expect(light).toBeDefined();
    expect(heavy).toBeDefined();
    expect(heavy!.maxCapableStep_mm).toBeLessThan(light!.maxCapableStep_mm);
  });

  it("respects the series filter", () => {
    const result = selectPurlin({ ...baseInput, series: "МП390" });
    expect(result?.profile.series).toBe("МП390");
  });

  it("massPerRoofArea_kg_m2 is consistent with mass and step", () => {
    const result = selectPurlin(baseInput);
    expect(result).toBeDefined();
    const expected = result!.profile.mass_kg_per_m / (result!.step_mm / 1000);
    expect(result!.massPerRoofArea_kg_m2).toBeCloseTo(expected, 9);
  });
});
