import { describe, expect, it } from "vitest";
import { computeDowelFasteners } from "./dowelFasteners";

describe("computeDowelFasteners", () => {
  it("matches real project '22316': span=18, length=30 -> 193 шт", () => {
    expect(computeDowelFasteners(2 * (18 + 30)).count).toBe(193);
  });

  it("matches real project '22318': span=15, length=24 -> 157 шт", () => {
    expect(computeDowelFasteners(2 * (15 + 24)).count).toBe(157);
  });

  it("mass is count times the known unit mass", () => {
    const result = computeDowelFasteners(2 * (18 + 30));
    expect(result.mass_kg).toBeCloseTo(result.count * 0.0048, 9);
  });

  it("scales linearly with perimeter", () => {
    const small = computeDowelFasteners(50);
    const large = computeDowelFasteners(100);
    expect(large.count - small.count).toBe(100);
  });
});
