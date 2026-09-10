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
    expect(result!.pricePerM2).toBe(3060);
    expect(result!.cost).toBe(306000);
    expect(result!.mass_kg).toBeCloseTo(2485, 6); // 24,85 кг/м² × 100 м²
  });

  it("computes roof cost independent of fixing type", () => {
    const result = estimateSandwichPanelCladding(50, 150, "roof");
    expect(result!.pricePerM2).toBe(3320);
    expect(result!.cost).toBe(166000);
  });

  it("uses the ТУ block the source calculation uses, not the ГОСТ one", () => {
    // Ведомости ссылаются на [2]СП!$I$11 = 2740 ₽/м², масса L11 = 20,1;
    // блок ГОСТ дал бы 2930 ₽/м² и 20,3 кг/м².
    const wall100 = estimateSandwichPanelCladding(1, 100, "wall", "zLock");
    expect(wall100!.pricePerM2).toBe(2740);
    expect(wall100!.mass_kg).toBeCloseTo(20.1, 9);
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

describe("панель «ПИР» — выбор заказчика по ТЗ, не редкий случай (расчётчик, «21550»)", () => {
  it("lists the same thicknesses as ТУ", () => {
    expect(getSandwichPanelThicknesses("ПИР")).toEqual([50, 80, 100, 120, 150, 200, 250]);
  });

  it("prices wall and roof off the master price list's «ПИР» block (not «ПИР (ППИ L)»)", () => {
    // «21550»: ссылка в файле ([2]СП!$C$29) ведёт на первый столбец "ПИР "
    // (плотность 41 кг/м³), не на второй, "ПИР (ППИ L)" (38 кг/м³).
    const wall = estimateSandwichPanelCladding(100, 150, "wall", "zLock", "ПИР");
    expect(wall!.pricePerM2).toBe(4370);
    const roof = estimateSandwichPanelCladding(100, 150, "roof", "zLock", "ПИР");
    expect(roof!.pricePerM2).toBe(4600);
  });

  it("has no mass data for ПИР — the price list carries no weight column for this block", () => {
    const result = estimateSandwichPanelCladding(100, 150, "wall", "zLock", "ПИР");
    expect(result!.mass_kg).toBeNull();
  });

  it("defaults to ТУ when material is omitted", () => {
    const withoutMaterial = estimateSandwichPanelCladding(100, 150, "wall", "zLock");
    expect(withoutMaterial!.pricePerM2).toBe(3060);
  });
});
