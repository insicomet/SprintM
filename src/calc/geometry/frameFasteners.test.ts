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

  it("total mass is the sum of all three categories at their known unit masses", () => {
    const result = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
    expect(result.fc11_14Mass_kg).toBeCloseTo(result.fc11_14Count * 1.4, 6);
    expect(result.fc12Mass_kg).toBeCloseTo(result.fc12Count * 0.5, 6);
    expect(result.screw525Mass_kg).toBeCloseTo(result.screw525Count * 0.0043, 6);
    expect(result.totalMass_kg).toBeCloseTo(
      result.fc11_14Mass_kg + result.fc12Mass_kg + result.screw525Mass_kg,
      9,
    );
  });

  it("scales with frame count", () => {
    const one = computeFrameFasteners({ span_m: 18, height_m: 5 }, 1);
    const eight = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
    expect(eight.fc11_14Count).toBeCloseTo(one.fc11_14Count * 8, 6);
  });

  describe("Саморез 5,5x25 rate — verified against 4 real examples in file '22318'", () => {
    it.each([
      [12, 530],
      [15, 614],
      [18, 634],
      [21, 890],
    ] as const)("span %im -> rate %i per frame", (span, rate) => {
      const result = computeFrameFasteners({ span_m: span, height_m: 5 }, 11);
      expect(result.screw525Count).toBe(11 * rate);
      expect(result.screw525RateIsEstimated).toBe(false);
    });

    it("falls back to the nearest known rate for 9m and 24m, flagged as estimated", () => {
      const nine = computeFrameFasteners({ span_m: 9, height_m: 5 }, 5);
      expect(nine.screw525Count).toBe(5 * 530);
      expect(nine.screw525RateIsEstimated).toBe(true);

      const twentyFour = computeFrameFasteners({ span_m: 24, height_m: 5 }, 5);
      expect(twentyFour.screw525Count).toBe(5 * 890);
      expect(twentyFour.screw525RateIsEstimated).toBe(true);
    });

    it("matches the exact reference value for span=18, 11 frames (file '22318', sheet '18')", () => {
      // C85 = K90*634 = 11*634 = 6974
      const result = computeFrameFasteners({ span_m: 18, height_m: 6 }, 11);
      expect(result.screw525Count).toBe(6974);
    });
  });
});
