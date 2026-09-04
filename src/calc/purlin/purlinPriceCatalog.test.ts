import { describe, expect, it } from "vitest";
import { findPurlinPrice } from "./purlinPriceCatalog";
import { getPurlinCatalog } from "./catalog";

describe("findPurlinPrice", () => {
  it("doubles the single-profile mass/price for 2ТПС (pair of ТПС)", () => {
    // ТПС 145х45 с перфор. 1,5 (Оцинк.): weight 2.6716, priceSale 443.1
    const result = findPurlinPrice("2ТПС 145х45х1,5");
    expect(result).not.toBeNull();
    expect(result!.massPerM_kg).toBeCloseTo(2 * 2.6716, 4);
    expect(result!.priceSale_perM).toBeCloseTo(2 * 443.1, 4);
  });

  it("matches Z profiles against the single ПZ family (no doubling)", () => {
    const result = findPurlinPrice("Z 250х1,5");
    expect(result).not.toBeNull();
    expect(result!.massPerM_kg).toBeCloseTo(4.9437, 4);
  });

  it("returns null for an unparseable name", () => {
    expect(findPurlinPrice("бред")).toBeNull();
  });

  it("resolves almost every profile in the purlin candidate catalog", () => {
    // Реальный пробел прайса (не баг сопоставления): ПС 145х45 и 195х45
    // в прайс-листе останавливаются на 1,5мм — толщины 2мм для этих
    // двух ширин просто не завозят/не прайсуют.
    const all = getPurlinCatalog();
    const unmatched = all.filter((p) => findPurlinPrice(p.name) === null);
    expect(unmatched.map((p) => p.name)).toEqual([
      "2ПС 145х45х2",
      "2ПС 145х45х2",
      "2ПС 195х45х2",
      "2ПС 195х45х2",
    ]);
  });

  it("mass from the price catalog is close to the candidate catalog's own mass_kg_per_m", () => {
    // Каталог кандидатов (purlinCatalog*.json) и прайс-лист — разные
    // источники одних и тех же профилей; масса совпадает с точностью
    // до нормального округления сортамента, не побитово.
    const all = getPurlinCatalog();
    for (const p of all) {
      const price = findPurlinPrice(p.name);
      if (price?.massPerM_kg != null) {
        expect(price.massPerM_kg).toBeCloseTo(p.mass_kg_per_m, 0);
      }
    }
  });
});
