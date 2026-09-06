import { describe, expect, it } from "vitest";
import { computeFrameFasteners } from "./frameFasteners";

describe("computeFrameFasteners", () => {
  it("matches real project '22316' (C29 = I17*(C8+2*C10)/0.6)", () => {
    // span=18, height=5, frameCount=8 -> Фс11,14=373.33, Фс12=746.67
    const result = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
    expect(result.fc11_14Count).toBeCloseTo(373.33333, 4);
    expect(result.fc12Count).toBeCloseTo(746.66667, 4);
  });

  it("matches real project '22318' (same formula, different inputs)", () => {
    // span=15, height=5, frameCount=7 -> Фс11,14=291.67, Фс12=583.33
    const result = computeFrameFasteners({ span_m: 15, height_m: 5 }, 7);
    expect(result.fc11_14Count).toBeCloseTo(291.66667, 4);
    expect(result.fc12Count).toBeCloseTo(583.33333, 4);
  });

  it("Фс12 is always exactly twice Фс11,14", () => {
    const result = computeFrameFasteners({ span_m: 12, height_m: 4 }, 6);
    expect(result.fc12Count).toBeCloseTo(2 * result.fc11_14Count, 9);
  });

  it("total mass is the sum of all categories at their known unit masses", () => {
    const result = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
    expect(result.fc11_14Mass_kg).toBeCloseTo(result.fc11_14Count * 1.4, 6);
    expect(result.fc12Mass_kg).toBeCloseTo(result.fc12Count * 0.5, 6);
    expect(result.screw525Mass_kg).toBeCloseTo(result.screw525Count * 0.0043, 6);
    expect(result.boltM16Mass_kg).toBeCloseTo(result.boltM16Count * 0.12, 6);
    expect(result.boltM12Mass_kg).toBeCloseTo(result.boltM12Count * 0.05, 6);
    expect(result.totalMass_kg).toBeCloseTo(
      result.fc11_14Mass_kg +
        result.fc12Mass_kg +
        result.screw525Mass_kg +
        result.boltM16Mass_kg +
        result.boltM12Mass_kg,
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

    it("matches real project '22316': span=18, 8 frames -> 5072 шт (=K90*634)", () => {
      expect(computeFrameFasteners({ span_m: 18, height_m: 5 }, 8).screw525Count).toBe(5072);
    });

    it("matches real project '22318': span=15, 7 frames -> 4298 шт (=K90*614)", () => {
      expect(computeFrameFasteners({ span_m: 15, height_m: 5 }, 7).screw525Count).toBe(4298);
    });
  });

  describe("Болт М16х50 — formula O88, verified on both real projects", () => {
    it("matches real project '22318': span=15, 7 frames -> 2202 шт (314,57 на раму)", () => {
      const result = computeFrameFasteners({ span_m: 15, height_m: 5 }, 7);
      expect(result.boltM16Count).toBeCloseTo(2202, 6);
      expect(result.boltM16RateIsEstimated).toBe(false);
    });

    it("matches real project '22316': span=18, 8 frames -> 2884 шт (360,5 на раму)", () => {
      const result = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
      expect(result.boltM16Count).toBeCloseTo(2884, 6);
      expect(result.boltM16RateIsEstimated).toBe(false);
    });

    it("flags spans without a confirmed base as estimated", () => {
      for (const span of [9, 12, 21, 24] as const) {
        const result = computeFrameFasteners({ span_m: span, height_m: 5 }, 8);
        expect(result.boltM16RateIsEstimated).toBe(true);
        expect(result.boltM16Count).toBeGreaterThan(0);
      }
    });

    it("uses the note's coefficient: 30 for spans up to 15м, 50 from 18м", () => {
      // При равном числе рам разница между пролётами 15 и 18 = разница
      // base (32) плюс разница coef, взвешенная на (рам-2)/рам.
      const at15 = computeFrameFasteners({ span_m: 15, height_m: 5 }, 8);
      const at18 = computeFrameFasteners({ span_m: 18, height_m: 5 }, 8);
      const perFrameDelta = (at18.boltM16Count - at15.boltM16Count) / 8;
      expect(perFrameDelta).toBeCloseTo(32 + (20 * (8 - 2)) / 8, 9);
    });
  });

  describe("Болт М12х40 — '=16*K90' in both real projects, independent of span", () => {
    it.each([15, 18] as const)("span %im is confirmed, 16 per frame", (span) => {
      const result = computeFrameFasteners({ span_m: span, height_m: 5 }, 8);
      expect(result.boltM12Count).toBe(8 * 16);
      expect(result.boltM12RateIsEstimated).toBe(false);
    });

    it("matches real project '22316': span=18, 8 frames -> 128 шт", () => {
      expect(computeFrameFasteners({ span_m: 18, height_m: 5 }, 8).boltM12Count).toBe(128);
    });

    it("matches real project '22318': span=15, 7 frames -> 112 шт", () => {
      expect(computeFrameFasteners({ span_m: 15, height_m: 5 }, 7).boltM12Count).toBe(112);
    });

    it("keeps the same rate for unconfirmed spans but flags them", () => {
      const result = computeFrameFasteners({ span_m: 21, height_m: 5 }, 8);
      expect(result.boltM12Count).toBe(8 * 16);
      expect(result.boltM12RateIsEstimated).toBe(true);
    });
  });
});
