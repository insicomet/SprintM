import { describe, expect, it } from "vitest";
import { selectFacadePost } from "./selectFacadePost";

const baseInput = {
  w0_kPa: 0.3,
  postSpacing_m: 2,
  height_m: 4,
};

describe("selectFacadePost", () => {
  it("computes wind load and moment by the documented formula", () => {
    const result = selectFacadePost(baseInput);
    expect(result).toBeDefined();
    // q = 0.3 * 0.8 * 2 = 0.48 kN/m; M = q*h^2/8 = 0.48*16/8 = 0.96 kNm
    expect(result!.windLoad_kN_per_m).toBeCloseTo(0.48, 6);
    expect(result!.moment_kNm).toBeCloseTo(0.96, 6);
  });

  it("picks a profile whose Wx covers the required value", () => {
    const result = selectFacadePost(baseInput);
    expect(result).toBeDefined();
    expect(result!.profile.Wx_cm3).toBeGreaterThanOrEqual(result!.requiredWx_cm3);
  });

  it("requires a heavier profile for taller / more loaded posts", () => {
    const light = selectFacadePost(baseInput);
    const heavy = selectFacadePost({ ...baseInput, height_m: 8, postSpacing_m: 4 });
    expect(light).toBeDefined();
    expect(heavy).toBeDefined();
    expect(heavy!.profile.mass_kg_per_m).toBeGreaterThan(light!.profile.mass_kg_per_m);
  });

  it("returns undefined when nothing in the catalog covers an absurd load", () => {
    const result = selectFacadePost({ w0_kPa: 500, postSpacing_m: 10, height_m: 20 });
    expect(result).toBeUndefined();
  });

  it("a custom aerodynamic coefficient scales the load linearly", () => {
    const base = selectFacadePost(baseInput)!;
    const scaled = selectFacadePost({ ...baseInput, aerodynamicCoef: 1.6 })!;
    expect(scaled.windLoad_kN_per_m).toBeCloseTo(base.windLoad_kN_per_m * 2, 6);
  });
});
