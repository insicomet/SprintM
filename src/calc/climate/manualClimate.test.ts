import { describe, expect, it } from "vitest";
import {
  manualSettlement,
  windPressureForDistrict_kPa,
  WIND_DISTRICTS,
} from "./manualClimate";
import { computeProject, type ProjectInputs } from "../project/computeProject";

describe("windPressureForDistrict_kPa", () => {
  it("matches the district-to-pressure pairing of our own reference base", () => {
    const expected: [string, number][] = [
      ["Ia", 0.17], ["I", 0.23], ["II", 0.3], ["III", 0.38],
      ["IV", 0.48], ["V", 0.6], ["VI", 0.73], ["VII", 0.85],
    ];
    for (const [d, w] of expected) expect(windPressureForDistrict_kPa(d), d).toBeCloseTo(w, 9);
    expect(windPressureForDistrict_kPa("VIII")).toBeNull();
    expect(WIND_DISTRICTS).toHaveLength(expected.length);
  });
});

describe("manualSettlement", () => {
  it("builds a settlement from a snow load and a wind district", () => {
    const c = manualSettlement({ snowLoad_kPa: 1.5, windDistrict: "II", label: "Дербент" });
    expect(c.settlement).toBe("Дербент");
    expect(c.snow.sgKpa).toBe(1.5);
    expect(c.wind.region).toBe("II");
    expect(c.wind.w0Kpa).toBeCloseTo(0.3, 9);
    // Снеговой район намеренно не задаётся — его выводит лестница нагрузок.
    expect(c.snow.region).toBeNull();
  });

  it("refuses a wind district outside СП 20.13330 and a non-positive load", () => {
    expect(() => manualSettlement({ snowLoad_kPa: 1.5, windDistrict: "IX" })).toThrow(/СП 20/);
    expect(() => manualSettlement({ snowLoad_kPa: 0, windDistrict: "II" })).toThrow(/больше нуля/);
  });
});

const base: ProjectInputs = {
  city: "",
  span: 18,
  length_m: 30,
  height_m: 5,
  gammaN: 1.0,
  bankK: "auto",
  roofingType: "С-П 150",
  deckingMark: "С44-1000-0,7",
  maxStepOverride_mm: 0,
  minStep_mm: 0,
  framePitchOverride_m: 0,
  wallPanel_mm: 100,
  roofPanel_mm: 150,
  openings: {
    gatesCount: 1, gateWidth_m: 4, gateHeight_m: 4.2,
    doorsCount: 1, doorWidth_m: 1, doorHeight_m: 2,
    windowsCount: 0, windowWidth_m: 0, windowHeight_m: 0,
  },
  snowGuards: true,
  railingPurlin: false,
  tubeStrutCount: 3,
  postSpacing_m: 2,
};

describe("computeProject с ручным вводом нагрузок", () => {
  it("gives the same answer as the city it stands in for", () => {
    // Берёзовский: снег 1,5 кПа, ветер I. Введённый руками — то же самое.
    const byCity = computeProject({ ...base, city: "Берёзовский, Свердловская область" });
    const byHand = computeProject({
      ...base,
      manualClimate: { snowLoad_kPa: 1.5, windDistrict: "I", label: "Без справочника" },
    });
    expect(byHand.climate.ok).toBe(true);
    if (!byCity.climate.ok || !byHand.climate.ok) throw new Error("климат не определился");
    expect(byHand.climate.value.standard).toBe(byCity.climate.value.standard);
    expect(byHand.bankBlock).toEqual(byCity.bankBlock);
    expect(byHand.purlin?.step_mm).toBe(byCity.purlin?.step_mm);
    expect(byHand.summary.steelMass_kg).toBeCloseTo(byCity.summary.steelMass_kg, 6);
  });

  it("serves a settlement that is not in the reference base at all", () => {
    expect(computeProject({ ...base, city: "Посёлок, которого нет" }).climate.ok).toBe(false);
    const byHand = computeProject({
      ...base,
      manualClimate: { snowLoad_kPa: 1.8, windDistrict: "II", label: "Новая площадка" },
    });
    expect(byHand.climate.ok).toBe(true);
    expect(byHand.frame?.ok).toBe(true);
  });

  it("does not paper over a gap in the bank itself", () => {
    // Дербент: снег есть (I, 0,5 кПа), ветрового района в справочнике нет,
    // поэтому по названию расчёт не идёт.
    expect(computeProject({ ...base, city: "Дербент" }).climate.ok).toBe(false);

    // Но и ручной ввод его не спасает: сочетание «снег I / ветер V» в
    // банке ИНСИ не просчитано, и приложение говорит об этом прямо, а не
    // подставляет соседнюю строку.
    const byHand = computeProject({
      ...base,
      manualClimate: { snowLoad_kPa: 0.5, windDistrict: "V", label: "Дербент" },
    });
    expect(byHand.climate.ok).toBe(false);
    if (byHand.climate.ok) throw new Error("ожидалась ошибка");
    expect(byHand.climate.error).toMatch(/банк/i);
  });

  it("says plainly when a hand-entered load is off the ladder", () => {
    const r = computeProject({ ...base, manualClimate: { snowLoad_kPa: 4, windDistrict: "II" } });
    expect(r.climate.ok).toBe(false);
    if (r.climate.ok) throw new Error("ожидалась ошибка");
    expect(r.climate.error).toMatch(/лестниц|конструктор/i);
  });
});
