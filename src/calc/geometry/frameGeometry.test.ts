import { describe, expect, it } from "vitest";
import {
  columnLengthPerFrame_m,
  computeFrameCount,
  rafterLengthPerFrame_m,
} from "./frameGeometry";

describe("computeFrameCount", () => {
  it("matches the reference example: length 30m, pitch 4.5m -> 8 frames (I17 in file 22316)", () => {
    // CEILING(30/4.5+1, 1) = CEILING(7.667, 1) = 8
    expect(computeFrameCount({ length_m: 30, framePitch_m: 4.5 })).toBe(8);
  });

  it("gives exactly (length/pitch + 1) frames for an exact multiple", () => {
    expect(computeFrameCount({ length_m: 24, framePitch_m: 6 })).toBe(5);
  });
});

describe("rafterLengthPerFrame_m", () => {
  it("equals span/cos(slope)", () => {
    const result = rafterLengthPerFrame_m({ span_m: 18, roofSlopeDeg: 15 });
    expect(result).toBeCloseTo(18 / Math.cos((15 * Math.PI) / 180), 9);
  });

  it("equals the span itself for a flat roof (0°)", () => {
    expect(rafterLengthPerFrame_m({ span_m: 18, roofSlopeDeg: 0 })).toBeCloseTo(18, 9);
  });
});

describe("columnLengthPerFrame_m", () => {
  it("is twice (height - 0.07)", () => {
    expect(columnLengthPerFrame_m({ height_m: 5 })).toBeCloseTo(2 * (5 - 0.07), 9);
  });
});
