import { describe, expect, it } from "vitest";
import { getFacadePostCatalog } from "./catalog";

describe("getFacadePostCatalog", () => {
  it("loads square and rectangular tube sections", () => {
    const all = getFacadePostCatalog();
    expect(all.length).toBeGreaterThan(300);
    expect(all.some((p) => p.section.startsWith("кв."))).toBe(true);
    expect(all.some((p) => p.section.startsWith("пр."))).toBe(true);
  });

  it("sorts ascending by mass", () => {
    const all = getFacadePostCatalog();
    for (let i = 1; i < all.length; i++) {
      expect(all[i].mass_kg_per_m).toBeGreaterThanOrEqual(all[i - 1].mass_kg_per_m);
    }
  });

  it("every profile has a positive section modulus", () => {
    const all = getFacadePostCatalog();
    expect(all.every((p) => p.Wx_cm3 > 0)).toBe(true);
  });
});
