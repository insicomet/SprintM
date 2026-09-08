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
    gates: [{ count: 1, width_m: 4, height_m: 4.2 }],
    doors: [{ count: 1, width_m: 1, height_m: 2 }],
    windows: [],
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

  it("counts the edge of the bank by the nearest row, and says so", () => {
    // Дербент: снег есть (I, 0,5 кПа), ветрового района в справочнике
    // нет — город стоит между IV и V. По указанию проектировщика
    // (вопрос 04) такой город больше не отбрасывается: берётся ближайшая
    // строка, а расчёт помечается «требует проверки».
    const byName = computeProject({ ...base, city: "Дербент" });
    expect(byName.climate.ok).toBe(true);
    expect(byName.requiresCheck).toBe(true);
    expect(byName.approximations.map((a) => a.kind).sort()).toEqual(["ветер", "сочетание"]);

    // Ручной ввод того же ветра даёт тот же результат — только пометка
    // остаётся одна: район задан явно, гадать не о чем.
    const byHand = computeProject({
      ...base,
      manualClimate: { snowLoad_kPa: 0.5, windDistrict: "V", label: "Дербент" },
    });
    expect(byHand.climate.ok).toBe(true);
    expect(byHand.approximations.map((a) => a.kind)).toEqual(["сочетание"]);
    expect(byHand.climate.ok && byHand.climate.value.standard).toBe(
      byName.climate.ok ? byName.climate.value.standard : "",
    );
  });

  it("counts a hand-entered load above the ladder by its last step", () => {
    const r = computeProject({ ...base, manualClimate: { snowLoad_kPa: 4, windDistrict: "II" } });
    expect(r.climate.ok).toBe(true);
    expect(r.requiresCheck).toBe(true);
    expect(r.approximations).toHaveLength(1);
    expect(r.approximations[0].kind).toBe("лестница");
    expect(r.approximations[0].message).toMatch(/выше последней ступени/);
    // Считается по последней просчитанной ступени, а не по нагрузке 4 кПа.
    expect(r.bankBlock?.snowDistrict).toBe("V");
    expect(r.bankBlock?.designLoad_kPa).toBe(2.5);
  });
});
