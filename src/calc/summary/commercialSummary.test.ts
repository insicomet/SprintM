import { describe, expect, it } from "vitest";
import { computeCommercialSummary } from "./commercialSummary";

/**
 * Значения разделов реального проекта "22316" (лист "12м"):
 * F32=1 499 709,30  F100=1 053 876,29  F44=62 703,16  F114=1 502 256,33
 * F147=2 039 506,34  F70=92 971,11  F81=151 676,26  F160=921 840
 */
const project22316 = {
  frameMaterials: 1499709.303380665 + 1053876.2881239487,
  wallMaterials: 62703.15789473685 + 1502256.3264000001,
  roofMaterials: 2039506.3353061413 + 92971.10571428572 + 151676.2614857143,
  openingsCost: 921840,
};

function byName(summary: ReturnType<typeof computeCommercialSummary>) {
  return Object.fromEntries(summary.lines.map((l) => [l.name, l]));
}

describe("computeCommercialSummary", () => {
  it("reproduces the three commercial lines of real project '22316'", () => {
    const lines = byName(computeCommercialSummary(project22316));
    expect(lines["Каркас"].cost).toBeCloseTo(2604657.303334706, 4);
    expect(lines["Стеновое ограждение"].cost).toBeCloseTo(1596258.6739806319, 4);
    expect(lines["Кровельное ограждение"].cost).toBeCloseTo(2329836.776556264, 4);
  });

  it("the three lines sum to «ИТОГО Цена + упаковка» (F151)", () => {
    const result = computeCommercialSummary(project22316);
    expect(result.materialsWithPackaging).toBeCloseTo(6530752.753871601, 3);
  });

  it("adds the openings on top, without packaging", () => {
    const result = computeCommercialSummary(project22316);
    expect(result.openingsCost).toBe(921840);
    expect(result.totalCost).toBeCloseTo(6530752.753871601 + 921840, 3);
  });

  it("applies exactly 2% packaging to each material line", () => {
    const result = computeCommercialSummary({
      frameMaterials: 100,
      wallMaterials: 200,
      roofMaterials: 300,
      openingsCost: 0,
    });
    const lines = byName(result);
    expect(lines["Каркас"].cost).toBeCloseTo(102, 9);
    expect(lines["Стеновое ограждение"].cost).toBeCloseTo(204, 9);
    expect(lines["Кровельное ограждение"].cost).toBeCloseTo(306, 9);
    expect(result.materialsWithPackaging).toBeCloseTo(612, 9);
  });

  it("reports no total when a material line is incomplete", () => {
    const result = computeCommercialSummary({
      frameMaterials: null,
      wallMaterials: 200,
      roofMaterials: 300,
      openingsCost: 50,
      frameMissing: "связи",
    });
    expect(byName(result)["Каркас"].cost).toBeNull();
    expect(byName(result)["Каркас"].missing).toBe("связи");
    expect(result.materialsWithPackaging).toBeNull();
    expect(result.totalCost).toBeNull();
    // Проёмы при этом известны и показываются.
    expect(result.openingsCost).toBe(50);
  });
});
