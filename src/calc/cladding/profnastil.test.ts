import { describe, expect, it } from "vitest";
import { estimateProfnastilCladding, getProfnastilThicknesses } from "./profnastil";

describe("getProfnastilThicknesses", () => {
  it("lists 0,5 and 0,7 мм for both marks", () => {
    expect(getProfnastilThicknesses("С-18")).toEqual([0.5, 0.7]);
    expect(getProfnastilThicknesses("С-44")).toEqual([0.5, 0.7]);
  });

  it("returns nothing for an unknown mark", () => {
    expect(getProfnastilThicknesses("С-8")).toEqual([]);
  });
});

describe("estimateProfnastilCladding", () => {
  it("computes wall (С-18) cost and mass at the default painted coating", () => {
    // Прайс ИНСИ, лист «Профлист,доборы»: С-18 окр. 0,5мм = 794,65 ₽/м², 5,3 кг/м².
    const result = estimateProfnastilCladding(100, "С-18", 0.5);
    expect(result).not.toBeNull();
    expect(result!.pricePerM2).toBe(794.65);
    expect(result!.cost).toBe(79465);
    expect(result!.mass_kg).toBeCloseTo(530, 9);
  });

  it("computes roof (С-44) cost independently of the wall mark", () => {
    // С-44 окр. 0,7мм = 925 ₽/м², 7,4 кг/м².
    const result = estimateProfnastilCladding(50, "С-44", 0.7);
    expect(result!.pricePerM2).toBe(925);
    expect(result!.cost).toBe(46250);
    expect(result!.mass_kg).toBeCloseTo(370, 9);
  });

  it("supports the galvanised coating explicitly", () => {
    // С-18 оцинк. 0,7мм = 808,289 ₽/м² — дешевле окрашенного (1069,5).
    const result = estimateProfnastilCladding(1, "С-18", 0.7, "оцинк.");
    expect(result!.pricePerM2).toBeCloseTo(808.289, 6);
  });

  it("returns null for an unlisted thickness or mark", () => {
    expect(estimateProfnastilCladding(10, "С-18", 1.0)).toBeNull();
    expect(estimateProfnastilCladding(10, "С-8", 0.5)).toBeNull();
  });
});
