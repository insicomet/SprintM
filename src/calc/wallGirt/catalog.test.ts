import { describe, expect, it } from "vitest";
import { getGirtProfileOptions, pairedGirtProfile } from "./catalog";

describe("getGirtProfileOptions", () => {
  it("parses «ПС 145х45х1,5» and «х1,2» from the fresh 1С price list (11.09.2026)", () => {
    const options = getGirtProfileOptions();
    const t15 = options.find((o) => o.name === "ПС 145х45х1,5");
    const t12 = options.find((o) => o.name === "ПС 145х45х1,2");
    expect(t15).toMatchObject({ family: "ПС", size: "145х45", thickness_mm: 1.5 });
    expect(t15!.weightPerMeter_kg).toBeCloseTo(2.9522, 4);
    expect(t15!.pricePerMeter).toBeCloseTo(450.45, 2);
    expect(t12).toMatchObject({ family: "ПС", size: "145х45", thickness_mm: 1.2 });
    expect(t12!.weightPerMeter_kg).toBeCloseTo(2.3791, 4);
  });

  it("includes ПП/ТПС/ТПП families too", () => {
    const options = getGirtProfileOptions();
    expect(options.some((o) => o.family === "ПП")).toBe(true);
    expect(options.some((o) => o.family === "ТПС")).toBe(true);
    expect(options.some((o) => o.family === "ТПП")).toBe(true);
  });

  it("has no duplicate entries for the same profile+thickness (П350/П390 coalesced)", () => {
    const options = getGirtProfileOptions();
    const names = options.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("pairedGirtProfile", () => {
  it("doubles weight and price, matching the purlin bank's «2ПС 145х45х1,5» = 5,9 кг/м", () => {
    const single = getGirtProfileOptions().find((o) => o.name === "ПС 145х45х1,5")!;
    const paired = pairedGirtProfile(single);
    expect(paired.name).toBe("2ПС 145х45х1,5");
    // Банк прогонов (purlinCatalog390.json) держит эту позицию как 5,9 кг/м.
    expect(paired.weightPerMeter_kg).toBeCloseTo(5.9, 1);
    expect(paired.pricePerMeter).toBeCloseTo(single.pricePerMeter! * 2, 2);
  });

  it("keeps price null when the source profile has no price", () => {
    const single = { ...getGirtProfileOptions()[0], pricePerMeter: null };
    expect(pairedGirtProfile(single).pricePerMeter).toBeNull();
  });
});
