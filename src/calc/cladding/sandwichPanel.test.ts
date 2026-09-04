import { describe, expect, it } from "vitest";
import { estimateSandwichPanelCladding, getSandwichPanelThicknesses } from "./sandwichPanel";

describe("getSandwichPanelThicknesses", () => {
  it("lists the 7 available thicknesses", () => {
    expect(getSandwichPanelThicknesses()).toEqual([50, 80, 100, 120, 150, 200, 250]);
  });
});

describe("estimateSandwichPanelCladding", () => {
  it("computes wall cost and mass for a known thickness (Z-lock)", () => {
    const result = estimateSandwichPanelCladding(100, 150, "wall", "zLock");
    expect(result).not.toBeNull();
    expect(result!.pricePerM2).toBe(3300);
    expect(result!.cost).toBe(330000);
    expect(result!.mass_kg).toBeCloseTo(2560, 6); // 25.6 kg/m2 * 100 m2
  });

  it("computes roof cost independent of fixing type", () => {
    const result = estimateSandwichPanelCladding(50, 150, "roof");
    expect(result!.pricePerM2).toBe(3510);
    expect(result!.cost).toBe(175500);
  });

  it("returns null cost (not a crash) where the price list has '-' (e.g. 200mm Secret Fix)", () => {
    const result = estimateSandwichPanelCladding(50, 200, "wall", "secretFix");
    expect(result).not.toBeNull();
    expect(result!.pricePerM2).toBeNull();
    expect(result!.cost).toBeNull();
  });

  it("returns null for an unlisted thickness", () => {
    expect(estimateSandwichPanelCladding(50, 999, "wall")).toBeNull();
  });
});
