import { describe, expect, it } from "vitest";
import { computePurlinLayout } from "./purlinLayout";
import { selectPurlin } from "./selectPurlin";

describe("computePurlinLayout", () => {
  it("computes line count, total length and mass consistently", () => {
    const purlin = selectPurlin({
      roofLoad_kPa: 2.3,
      framePitch_m: 6,
      minStep_mm: 500,
      maxStep_mm: 1500,
    });
    expect(purlin).toBeDefined();

    const rafterLength_m = 18.6; // ~ span/cos(slope) for an 18m span
    const buildingLength_m = 30;
    const layout = computePurlinLayout(purlin!, rafterLength_m, buildingLength_m);

    const stepM = purlin!.step_mm / 1000;
    expect(layout.lineCount).toBe(Math.ceil(rafterLength_m / stepM + 1));
    expect(layout.totalLength_m).toBe(layout.lineCount * buildingLength_m);
    expect(layout.totalMass_kg).toBeCloseTo(layout.totalLength_m * purlin!.profile.mass_kg_per_m, 6);
  });

  it("more lines are needed for a smaller step", () => {
    const purlin = selectPurlin({
      roofLoad_kPa: 2.3,
      framePitch_m: 6,
      minStep_mm: 500,
      maxStep_mm: 1500,
    });
    const wide = computePurlinLayout(purlin!, 18.6, 30);
    const narrower = { ...purlin!, step_mm: purlin!.step_mm / 2 };
    const narrow = computePurlinLayout(narrower, 18.6, 30);
    expect(narrow.lineCount).toBeGreaterThan(wide.lineCount);
  });
});
