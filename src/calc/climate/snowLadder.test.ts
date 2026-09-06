import { describe, expect, it } from "vitest";
import { roofingSupplement_kPa, selectBankBlock } from "./snowLadder";

describe("roofingSupplement_kPa", () => {
  it("reads the supplement per roofing type (снегветер!AM6:AN23)", () => {
    expect(roofingSupplement_kPa("С-П 150")).toBeCloseTo(0.1, 9);
    expect(roofingSupplement_kPa("С-П 250")).toBeCloseTo(0.2, 9);
    expect(roofingSupplement_kPa("профлист")).toBeCloseTo(-0.1, 9);
    expect(roofingSupplement_kPa("наше 100 мм")).toBe(0);
  });

  it("has nothing for the low-slope roofs the table never listed", () => {
    // Обе «малоуклонные» есть в списке покрытий, но не в лестнице.
    expect(roofingSupplement_kPa("малоуклонная кровля с подв. п.")).toBeNull();
    expect(roofingSupplement_kPa("малоуклонная кровля без подв. п.")).toBeNull();
    expect(roofingSupplement_kPa("чего-то такого нет")).toBeNull();
  });
});

describe("selectBankBlock", () => {
  /** Все четыре города снятые прямо из листа «снегветер» подборщика. */
  const cases = [
    { city: "Берёзовский", snow: 1.5, g1: ["IV", 0.8, 1.6], g08: ["III", 0.8] },
    { city: "Сургут", snow: 1.8, g1: ["IV", 1, 2], g08: ["III", 1] },
    { city: "Новосибирск", snow: 1.6, g1: ["IV", 0.8, 1.6], g08: ["III", 1] },
    { city: "Челябинск", snow: 1.2, g1: ["III", 0.8, 1.2000000000000002], g08: ["III", 0.8] },
  ] as const;

  for (const c of cases) {
    it(`reproduces ${c.city} (снег ${c.snow} кПа, кровля С-П 150)`, () => {
      const at1 = selectBankBlock(c.snow, "С-П 150", 1.0)!;
      expect(at1.snowDistrict).toBe(c.g1[0]);
      expect(at1.bankK).toBe(c.g1[1]);
      expect(at1.designLoad_kPa).toBeCloseTo(c.g1[2] as number, 9);
      expect(at1.lookupLoad_kPa).toBeCloseTo(c.snow + 0.1, 9);

      const at08 = selectBankBlock(c.snow, "С-П 150", 0.8)!;
      expect(at08.snowDistrict).toBe(c.g08[0]);
      expect(at08.bankK).toBe(c.g08[1]);
    });
  }

  it("tolerates an overshoot of at most 0,10 кПа, and never more", () => {
    // Лестница допускает перебор ровно на две ступени по 0,05 кПа: на
    // каждой границе района последние два порога держат ещё старую пару.
    let worst = 0;
    for (let load = 0.4; load <= 2.6; load += 0.05) {
      const block = selectBankBlock(load, "С-П 100", 1.0);
      if (!block) continue;
      worst = Math.max(worst, block.lookupLoad_kPa - block.designLoad_kPa);
    }
    expect(worst).toBeGreaterThan(0.09);
    expect(worst).toBeLessThan(0.11);
  });

  it("the roofing type can move the building a whole district", () => {
    // 1,55 кПа: с профлистом (−0,1) остаётся III, с С-П 250 (+0,2) уходит в IV.
    expect(selectBankBlock(1.55, "профлист", 1.0)!.snowDistrict).toBe("III");
    expect(selectBankBlock(1.55, "С-П 250", 1.0)!.snowDistrict).toBe("IV");
  });

  it("gives nothing below the first step and above the engineer's line", () => {
    expect(selectBankBlock(0.2, "С-П 100", 1.0)).toBeNull();
    // Выше 3,2 кПа таблица говорит «уточнить у главного конструктора».
    expect(selectBankBlock(3.5, "С-П 100", 1.0)).toBeNull();
  });

  it("refuses a roofing the ladder has no supplement for, instead of assuming zero", () => {
    expect(selectBankBlock(1.5, "малоуклонная кровля с подв. п.", 1.0)).toBeNull();
  });
});
