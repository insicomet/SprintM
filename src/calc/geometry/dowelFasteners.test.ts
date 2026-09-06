import { describe, expect, it } from "vitest";
import { computeDowelFasteners } from "./dowelFasteners";

describe("computeDowelFasteners", () => {
  it("matches the reference example: span=15, length=24 (file '22318', sheet '12м') -> 157", () => {
    const result = computeDowelFasteners(15, 2 * (15 + 24));
    expect(result.count).toBe(157);
    expect(result.isEstimated).toBe(false);
  });

  it("matches the reference example: span=15, length=60 (file '22318', sheet '15') -> 301", () => {
    const result = computeDowelFasteners(15, 2 * (15 + 60));
    expect(result.count).toBe(301);
  });

  it("matches the reference example: span=18, length=60 (file '22318', sheet '18') -> 313", () => {
    const result = computeDowelFasteners(18, 2 * (18 + 60));
    expect(result.count).toBe(313);
  });

  it("matches the reference example: span=12, length=60 (file '22318', sheet '1ск') -> 289", () => {
    const result = computeDowelFasteners(12, 2 * (12 + 60));
    expect(result.count).toBe(289);
  });

  it("matches the reference example: span=21, length=60, double density (file '22318', sheet '21') -> 648", () => {
    const result = computeDowelFasteners(21, 2 * (21 + 60));
    expect(result.count).toBe(648);
    expect(result.isEstimated).toBe(false);
  });

  it("flags span=24 as estimated (no reference example, assumes double density like span 21)", () => {
    const result = computeDowelFasteners(24, 2 * (24 + 60));
    expect(result.isEstimated).toBe(true);
    expect(result.count).toBe((2 * (24 + 60)) / 0.5 * 2);
  });

  it("mass is count times the known unit mass", () => {
    const result = computeDowelFasteners(18, 2 * (18 + 60));
    expect(result.mass_kg).toBeCloseTo(result.count * 0.0048, 9);
  });
});
