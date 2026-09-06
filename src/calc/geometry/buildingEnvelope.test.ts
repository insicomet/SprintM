import { describe, expect, it } from "vitest";
import { computeRoofArea_m2, computeWallArea_m2 } from "./buildingEnvelope";

describe("computeRoofArea_m2", () => {
  it("matches real project '22316': 18×30 -> 556,2 м² (пятно × 1,03)", () => {
    const geometry = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, roofSlopeDeg: 15 };
    expect(computeRoofArea_m2(geometry)).toBeCloseTo(556.2, 6);
  });

  it("matches real project '22318': 15×24 -> 370,8 м²", () => {
    const geometry = { span_m: 15, length_m: 24, height_m: 5, framePitch_m: 4, roofSlopeDeg: 15 };
    expect(computeRoofArea_m2(geometry)).toBeCloseTo(370.8, 6);
  });

  it("uses a flat 3% allowance rather than the true slope factor", () => {
    const base = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5 };
    // От уклона не зависит вовсе...
    expect(computeRoofArea_m2({ ...base, roofSlopeDeg: 0 })).toBe(
      computeRoofArea_m2({ ...base, roofSlopeDeg: 15 }),
    );
    // ...и немного меньше геометрической площади по скату (1,03 против 1,0353).
    expect(computeRoofArea_m2({ ...base, roofSlopeDeg: 15 })).toBeLessThan(
      (18 / Math.cos((15 * 3.14) / 180)) * 30,
    );
  });
});

describe("computeWallArea_m2", () => {
  it("matches real project '22316': 18×30, высота 5 -> 552 м² до вычета проёмов", () => {
    // (18+30)×2×5 + 18×2×2 = 480 + 72
    const geometry = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, roofSlopeDeg: 15 };
    expect(computeWallArea_m2(geometry)).toBeCloseTo(552, 6);
  });

  it("matches real project '22318': 15×24, высота 5 -> 450 м² до вычета проёмов", () => {
    // (15+24)×2×5 + 15×2×2 = 390 + 60
    const geometry = { span_m: 15, length_m: 24, height_m: 5, framePitch_m: 4, roofSlopeDeg: 15 };
    expect(computeWallArea_m2(geometry)).toBeCloseTo(450, 6);
  });

  it("does not depend on roof pitch — the gable allowance is a flat 2×пролёт per gable", () => {
    const base = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5 };
    expect(computeWallArea_m2({ ...base, roofSlopeDeg: 0 })).toBe(
      computeWallArea_m2({ ...base, roofSlopeDeg: 15 }),
    );
  });
});
