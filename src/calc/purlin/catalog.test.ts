import { describe, expect, it } from "vitest";
import { getPurlinCatalog, PURLIN_SERIES } from "./catalog";

describe("purlin catalog", () => {
  it("loads 50 profiles per steel series", () => {
    for (const series of PURLIN_SERIES) {
      const rows = getPurlinCatalog(series);
      expect(rows.length).toBe(50);
      expect(rows.every((p) => p.series === series)).toBe(true);
    }
  });

  it("assigns family by name prefix", () => {
    const all = PURLIN_SERIES.flatMap((s) => [...getPurlinCatalog(s)]);
    expect(all.every((p) => ["2ТПС", "2ПС", "Z"].includes(p.family))).toBe(true);
  });

  it("keeps the source order — it decides ties between equally light profiles", () => {
    const rows = getPurlinCatalog("МП350");
    expect(rows[0].name).toBe("2ТПС 145х45х1,5");
    expect(rows[11].name).toBe("2ПС 145х45х1,5");
    expect(rows[25].name).toBe("Z 140х1,5");
    expect(rows[49].name).toBe("Z 350х3");
    // Ровно по порядку исходника — массы не монотонны.
    expect(rows[3].mass_kg_per_m).toBeLessThan(rows[2].mass_kg_per_m);
  });

  it("carries the insulation thickness only for 2ТПС", () => {
    const rows = getPurlinCatalog("МП350");
    expect(rows.filter((p) => p.family === "2ТПС").every((p) => p.insulationThickness_mm !== null)).toBe(
      true,
    );
    expect(rows.filter((p) => p.family !== "2ТПС").every((p) => p.insulationThickness_mm === null)).toBe(
      true,
    );
  });

  it("МП390 profiles carry more moment than МП350 at the same section", () => {
    const a = getPurlinCatalog("МП350");
    const b = getPurlinCatalog("МП390");
    for (let i = 0; i < a.length; i++) {
      expect(b[i].name).toBe(a[i].name);
      expect(b[i].mass_kg_per_m).toBe(a[i].mass_kg_per_m);
      expect(b[i].limitMoment_kNm).toBeGreaterThan(a[i].limitMoment_kNm);
    }
  });
});
