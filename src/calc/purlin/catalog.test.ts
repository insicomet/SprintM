import { describe, expect, it } from "vitest";
import { getPurlinCatalog } from "./catalog";

describe("purlin catalog", () => {
  it("loads both series and filters out the trailing garbage row ('Толщина')", () => {
    const all = getPurlinCatalog();
    expect(all.length).toBe(100); // 50 valid rows per series (51 extracted - 1 header artifact)
    expect(all.some((p) => p.name === "Толщина")).toBe(false);
  });

  it("assigns family by name prefix", () => {
    const all = getPurlinCatalog();
    expect(all.every((p) => ["2ТПС", "2ПС", "Z"].includes(p.family))).toBe(true);
  });

  it("filters by series", () => {
    const mp350 = getPurlinCatalog("МП350");
    expect(mp350.length).toBe(50);
    expect(mp350.every((p) => p.series === "МП350")).toBe(true);
  });

  it("sorts ascending by mass", () => {
    const all = getPurlinCatalog();
    for (let i = 1; i < all.length; i++) {
      expect(all[i].mass_kg_per_m).toBeGreaterThanOrEqual(all[i - 1].mass_kg_per_m);
    }
  });
});
