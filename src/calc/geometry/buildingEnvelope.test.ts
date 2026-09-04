import { describe, expect, it } from "vitest";
import { computeRoofArea_m2, computeWallArea_m2 } from "./buildingEnvelope";

describe("computeRoofArea_m2", () => {
  it("equals rafter length times building length", () => {
    const geometry = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, roofSlopeDeg: 15 };
    const expected = (18 / Math.cos((15 * Math.PI) / 180)) * 30;
    expect(computeRoofArea_m2(geometry)).toBeCloseTo(expected, 6);
  });

  it("equals span * length for a flat roof", () => {
    const geometry = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, roofSlopeDeg: 0 };
    expect(computeRoofArea_m2(geometry)).toBeCloseTo(18 * 30, 6);
  });
});

describe("computeWallArea_m2", () => {
  it("computes side walls + gable end walls with roof pitch", () => {
    const geometry = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, roofSlopeDeg: 15 };
    const sideWalls = 2 * 30 * 5;
    const rise = 9 * Math.tan((15 * Math.PI) / 180);
    const endWalls = 2 * (18 * 5 + 0.5 * 18 * rise);
    expect(computeWallArea_m2(geometry)).toBeCloseTo(sideWalls + endWalls, 6);
  });

  it("degenerates to a plain box (no gable triangle) for a flat roof", () => {
    const geometry = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, roofSlopeDeg: 0 };
    const expected = 2 * 30 * 5 + 2 * 18 * 5;
    expect(computeWallArea_m2(geometry)).toBeCloseTo(expected, 6);
  });
});
