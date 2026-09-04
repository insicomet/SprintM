import { describe, expect, it } from "vitest";
import { findPgsProperties } from "./pgsPriceCatalog";
import { parsePgsName } from "./parseProfileName";

describe("parsePgsName", () => {
  it("parses a plain name", () => {
    expect(parsePgsName("ПГС300/20х80х1,5")).toEqual({ h_mm: 300, b_mm: 80, t_mm: 1.5 });
  });

  it("ignores trailing suffixes (24m variants)", () => {
    expect(parsePgsName("ПГС300/20х80х2,5 М.П.390 сг по Р")).toEqual({
      h_mm: 300,
      b_mm: 80,
      t_mm: 2.5,
    });
  });

  it("returns null for a non-ПГС name", () => {
    expect(parsePgsName("2ТПС 200х65х2 (шаг 1,0м)")).toBeNull();
  });
});

describe("findPgsProperties", () => {
  it("finds mass and price for a known section, preferring Оцинк.", () => {
    const result = findPgsProperties({ h_mm: 300, b_mm: 80, t_mm: 1.5 });
    expect(result).not.toBeNull();
    expect(result!.coating).toBe("Оцинк.");
    expect(result!.massPerM_kg).toBeCloseTo(5.688, 2);
  });

  it("returns null for a dimension combination not in the price list", () => {
    const result = findPgsProperties({ h_mm: 999, b_mm: 999, t_mm: 9 });
    expect(result).toBeNull();
  });
});
