import { describe, expect, it } from "vitest";
import { computeRoofLoad, defaultRoofSlopeDeg } from "./roofLoad";

describe("computeRoofLoad", () => {
  it("sums snow, wind surcharge and dead load", () => {
    const result = computeRoofLoad({
      sgKpa: 1.2,
      roofSlopeDeg: 0,
      selfWeight_kg_m2: 25,
    });
    // snow = 1.2 * 1.4 * 1.1 * cos(0) * 100 = 184.8
    expect(result.snow_kg_m2).toBeCloseTo(184.8, 6);
    expect(result.wind_kg_m2).toBeCloseTo(20, 6); // 0.2 kPa * 100
    expect(result.dead_kg_m2).toBe(25);
    expect(result.total_kg_m2).toBeCloseTo(229.8, 6);
    expect(result.total_kPa).toBeCloseTo(2.298, 6);
  });

  it("reduces snow load with roof slope via cosine", () => {
    const flat = computeRoofLoad({ sgKpa: 1.5, roofSlopeDeg: 0, selfWeight_kg_m2: 0 });
    const sloped = computeRoofLoad({ sgKpa: 1.5, roofSlopeDeg: 15, selfWeight_kg_m2: 0 });
    expect(sloped.snow_kg_m2).toBeLessThan(flat.snow_kg_m2);
  });

  it("allows overriding gammaC and mu", () => {
    const result = computeRoofLoad({
      sgKpa: 1.0,
      roofSlopeDeg: 0,
      selfWeight_kg_m2: 0,
      gammaC: 1.0,
      mu: 1.0,
      windSurcharge_kPa: 0,
    });
    expect(result.total_kg_m2).toBeCloseTo(100, 6);
  });
});

describe("defaultRoofSlopeDeg", () => {
  it("returns 15° for spans up to 21m", () => {
    expect(defaultRoofSlopeDeg(18)).toBe(15);
    expect(defaultRoofSlopeDeg(21)).toBe(15);
  });
  it("returns 6° for spans over 21m", () => {
    expect(defaultRoofSlopeDeg(24)).toBe(6);
  });
});
