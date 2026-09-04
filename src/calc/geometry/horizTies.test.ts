import { describe, expect, it } from "vitest";
import { computeHorizTiesMass_kg } from "./horizTies";

describe("computeHorizTiesMass_kg", () => {
  it("matches the reference example: span=18, с/в=1/3, length=24 (file, sheet '18м')", () => {
    // S6 = AA6*23,76+957 = 24*23.76+957 = 1527.24
    const result = computeHorizTiesMass_kg(18, "1/3", 24);
    expect(result).toBeCloseTo(1527.24, 6);
  });

  it("matches the reference example: span=21, с/в=4/1, length=24 (file, sheet '21м')", () => {
    // S11 = AA11*23,76+444 = 24*23.76+444 = 1014.24
    const result = computeHorizTiesMass_kg(21, "4/1", 24);
    expect(result).toBeCloseTo(1014.24, 6);
  });

  it("matches the reference example: span=9, с/в=1/3, length=24 (file, sheet '9м', k=21,6 not 23,76)", () => {
    // S6 = AA6*21,6+456 = 24*21.6+456 = 974.4
    const result = computeHorizTiesMass_kg(9, "1/3", 24);
    expect(result).toBeCloseTo(974.4, 6);
  });

  it("scales linearly with building length", () => {
    const at24 = computeHorizTiesMass_kg(18, "1/3", 24);
    const at48 = computeHorizTiesMass_kg(18, "1/3", 48);
    expect(at24).not.toBeNull();
    expect(at48! - at24!).toBeCloseTo(24 * 23.76, 6);
  });

  it("returns null for a span/с/в combination not in the table (e.g. 24м)", () => {
    expect(computeHorizTiesMass_kg(24, "1/3", 30)).toBeNull();
  });
});
