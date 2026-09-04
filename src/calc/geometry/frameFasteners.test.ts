import { describe, expect, it } from "vitest";
import { computeFrameFasteners } from "./frameFasteners";

describe("computeFrameFasteners", () => {
  it("matches the reference example from file '22316' (12м!C29/C30)", () => {
    // span=18, height=5, frameCount=8 (CEILING(30/4.5+1,1)) -> Фс11,14=373.33, Фс12=746.67
    const result = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
    expect(result.fc11_14Count).toBeCloseTo(373.33333, 4);
    expect(result.fc12Count).toBeCloseTo(746.66667, 4);
  });

  it("Фс12 is always exactly twice Фс11,14", () => {
    const result = computeFrameFasteners({ span_m: 12, height_m: 4 }, 6);
    expect(result.fc12Count).toBeCloseTo(2 * result.fc11_14Count, 9);
  });

  it("total mass is the sum of both categories at their known unit masses", () => {
    const result = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
    expect(result.fc11_14Mass_kg).toBeCloseTo(result.fc11_14Count * 1.4, 6);
    expect(result.fc12Mass_kg).toBeCloseTo(result.fc12Count * 0.5, 6);
    expect(result.totalMass_kg).toBeCloseTo(result.fc11_14Mass_kg + result.fc12Mass_kg, 9);
  });

  it("scales with frame count", () => {
    const one = computeFrameFasteners({ span_m: 18, height_m: 5 }, 1);
    const eight = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
    expect(eight.fc11_14Count).toBeCloseTo(one.fc11_14Count * 8, 6);
  });
});
