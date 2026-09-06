import { describe, expect, it } from "vitest";
import { computeRoofTrim } from "./roofTrim";

/** Реальный проект "22316" (Березовский): пролёт 18, длина 30, снегозадержатель есть. */
const project22316 = { span_m: 18, length_m: 30 };
/** Реальный проект "22318" (Сургут): пролёт 15, длина 24, снегозадержателя нет. */
const project22318 = { span_m: 15, length_m: 24 };

function byName(takeoff: ReturnType<typeof computeRoofTrim>) {
  return Object.fromEntries(takeoff.items.map((i) => [i.name, i]));
}

describe("computeRoofTrim", () => {
  it("reproduces every quantity and cost of real project '22316'", () => {
    const items = byName(computeRoofTrim(project22316, { snowGuards: true }));
    expect(items["Лист 0,7мм оц"].count).toBeCloseTo(16.5, 9);
    expect(items["Лист 0,7мм оц"].cost).toBeCloseTo(9963.36, 6);
    expect(items["Конёк плоский (2м)"].count).toBe(16);
    expect(items["Конёк плоский (2м)"].cost).toBeCloseTo(27072, 6);
    expect(items["Фронтон (2м)"].count).toBe(20);
    expect(items["Фронтон (2м)"].cost).toBeCloseTo(14640, 6);
    expect(items["Снегозадержатель"].count).toBeCloseTo(42.857142857, 6);
    expect(items["Снегозадержатель"].cost).toBeCloseTo(77442.857142857, 6);
    expect(items["Уплотнитель (2м)"].count).toBe(32);
    expect(items["Уплотнитель (2м)"].cost).toBeCloseTo(19584, 6);
  });

  it("reproduces every quantity and cost of real project '22318'", () => {
    const items = byName(computeRoofTrim(project22318, { snowGuards: false }));
    expect(items["Лист 0,7мм оц"].count).toBeCloseTo(13.2, 9);
    expect(items["Лист 0,7мм оц"].cost).toBeCloseTo(7970.688, 6);
    expect(items["Конёк плоский (2м)"].count).toBe(13);
    expect(items["Конёк плоский (2м)"].cost).toBeCloseTo(21996, 6);
    expect(items["Фронтон (2м)"].count).toBe(17);
    expect(items["Фронтон (2м)"].cost).toBeCloseTo(12444, 6);
    expect(items["Снегозадержатель"].count).toBe(0);
    expect(items["Уплотнитель (2м)"].count).toBe(26);
    expect(items["Уплотнитель (2м)"].cost).toBeCloseTo(15912, 6);
  });

  it("reproduces the section total of real project '22316' (F81)", () => {
    const result = computeRoofTrim(project22316, { snowGuards: true });
    expect(result.overheadCost).toBeCloseTo(2974.044342857143, 6);
    expect(result.totalCost).toBeCloseTo(151676.2614857143, 6);
  });

  it("reproduces the section total of real project '22318' (F81)", () => {
    const result = computeRoofTrim(project22318, { snowGuards: false });
    expect(result.overheadCost).toBeCloseTo(1166.45376, 6);
    expect(result.totalCost).toBeCloseTo(59489.14176, 6);
  });

  it("ties the sealant count to the ridge cap count", () => {
    const items = byName(computeRoofTrim({ span_m: 21, length_m: 48 }, { snowGuards: false }));
    expect(items["Уплотнитель (2м)"].count).toBe(2 * items["Конёк плоский (2м)"].count);
  });

  it("adds the snow guard only when it is switched on", () => {
    const on = computeRoofTrim(project22318, { snowGuards: true });
    const off = computeRoofTrim(project22318, { snowGuards: false });
    expect(byName(on)["Снегозадержатель"].count).toBeCloseTo((2 * 24) / 1.4, 9);
    expect(on.totalCost).toBeGreaterThan(off.totalCost);
  });

  it("rounds ridge cap and gable counts up, like Excel CEILING(x,1)", () => {
    // 24/1.9 = 12.63 -> 13;  2*15/1.8 = 16.67 -> 17;  ровно 20 остаётся 20
    const items = byName(computeRoofTrim({ span_m: 18, length_m: 24 }, { snowGuards: false }));
    expect(items["Конёк плоский (2м)"].count).toBe(13);
    expect(items["Фронтон (2м)"].count).toBe(20);
  });
});
