import { describe, expect, it } from "vitest";
import { computeRoofCladdingSection, computeWallCladdingSection } from "./claddingSections";

/** Реальный проект "22316": 18×30, высота 5, шаг рам 4,5, 12 прогонов. */
const g22316 = { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, roofSlopeDeg: 15 };
/** Реальный проект "22318": 15×24, высота 5, шаг рам 4, 10 прогонов. */
const g22318 = { span_m: 15, length_m: 24, height_m: 5, framePitch_m: 4, roofSlopeDeg: 15 };

function byName(section: ReturnType<typeof computeWallCladdingSection>) {
  return Object.fromEntries(section.items.map((i) => [i.name, i]));
}

describe("computeWallCladdingSection", () => {
  it("reproduces real project '22316' (панель 504 м², шаг 4,5)", () => {
    const items = byName(computeWallCladdingSection(g22316, 504, 100));
    expect(items["СП 100 (стена, Z-lock)"].unitPrice).toBe(2740);
    expect(items["СП 100 (стена, Z-lock)"].cost).toBeCloseTo(1380960, 6);
    expect(items["с/з 5,5х140"].count).toBeCloseTo(739.2, 6);
    expect(items["с/з 5,5х140"].cost).toBeCloseTo(38364.48, 6);
    expect(items["БК шнур"].count).toBeCloseTo(844.8, 6);
    expect(items["БК шнур"].cost).toBeCloseTo(53475.84, 6);
  });

  it("reproduces the section total of '22316' (F114)", () => {
    const section = computeWallCladdingSection(g22316, 504, 100);
    expect(section.overheadCost).toBeCloseTo(29456.0064, 6);
    expect(section.totalCost).toBeCloseTo(1502256.3264, 4);
  });

  it("reproduces real project '22318' (панель 430 м², шаг 4)", () => {
    const items = byName(computeWallCladdingSection(g22318, 430, 100));
    expect(items["с/з 5,5х140"].count).toBeCloseTo(709.5, 6);
    expect(items["БК шнур"].count).toBeCloseTo(686.4, 6);
  });

  it("ties the sealant cord to whole metres of height above 1m", () => {
    // ВВЕРХ(высота − 1): и 4,2м и 5,0м дают 4.
    const at5 = byName(computeWallCladdingSection(g22316, 504, 100))["БК шнур"].count;
    const at42 = byName(computeWallCladdingSection({ ...g22316, height_m: 4.2 }, 504, 100))["БК шнур"]
      .count;
    expect(at42).toBeCloseTo(at5, 9);
  });
});

describe("computeRoofCladdingSection", () => {
  it("reproduces real project '22316' (556,2 м², 12 прогонов)", () => {
    const items = byName(computeRoofCladdingSection(g22316, 556.2, 150, 12));
    expect(items["СП 150 (кровля)"].unitPrice).toBe(3320);
    expect(items["СП 150 (кровля)"].cost).toBeCloseTo(1846584, 4);
    expect(items["с/з 5,5х190"].count).toBeCloseTo(792, 6);
    expect(items["с/з 5,5х190"].cost).toBeCloseTo(75081.6, 4);
    expect(items["БК шнур"].count).toBeCloseTo(1229.8643760824752, 6);
    expect(items["БК шнур"].cost).toBeCloseTo(77850.415006, 4);
  });

  it("reproduces the section total of '22316' (F147)", () => {
    const section = computeRoofCladdingSection(g22316, 556.2, 150, 12);
    expect(section.overheadCost).toBeCloseTo(39990.3203, 4);
    expect(section.totalCost).toBeCloseTo(2039506.3353, 3);
  });

  it("reproduces real project '22318' (370,8 м², 10 прогонов)", () => {
    const items = byName(computeRoofCladdingSection(g22318, 370.8, 150, 10));
    expect(items["СП 150 (кровля)"].cost).toBeCloseTo(1231056, 4);
    expect(items["с/з 5,5х190"].count).toBeCloseTo(528, 6);
    expect(items["БК шнур"].count).toBeCloseTo(819.9095840549834, 6);
  });

  it("reports no cost (rather than a wrong one) for a thickness the price list has no entry for", () => {
    const section = computeRoofCladdingSection(g22316, 556.2, 50, 12);
    expect(byName(section)["СП 50 (кровля)"].cost).toBeNull();
    expect(section.totalCost).toBeNull();
  });
});
