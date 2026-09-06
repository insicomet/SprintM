import { describe, expect, it } from "vitest";
import { computeFrameExtras } from "./frameExtras";

/** Реальный проект "22316": 18×30, высота 5, 8 рам. */
const project22316 = { geometry: { span_m: 18, length_m: 30, height_m: 5 }, frames: 8 };
/** Реальный проект "22318": 15×24, высота 5, 7 рам. */
const project22318 = { geometry: { span_m: 15, length_m: 24, height_m: 5 }, frames: 7 };

function byName(takeoff: ReturnType<typeof computeFrameExtras>) {
  return Object.fromEntries(takeoff.items.map((i) => [i.name, i]));
}

describe("computeFrameExtras", () => {
  it("reproduces every quantity of real project '22316'", () => {
    const items = byName(computeFrameExtras(project22316.geometry, project22316.frames));
    expect(items["ПС 145х1,5"].count).toBeCloseTo(120, 9);
    expect(items["Лист пл. оц. 1мм (тяж)"].count).toBeCloseTo(31.68, 9);
    expect(items["ПШ 61х1"].count).toBeCloseTo(61.6, 9);
  });

  it("reproduces every quantity of real project '22318'", () => {
    const items = byName(computeFrameExtras(project22318.geometry, project22318.frames));
    expect(items["ПС 145х1,5"].count).toBeCloseTo(96, 9);
    expect(items["Лист пл. оц. 1мм (тяж)"].count).toBeCloseTo(23.1, 9);
    expect(items["ПШ 61х1"].count).toBeCloseTo(55, 9);
  });

  it("reproduces the line costs of real project '22316'", () => {
    const items = byName(computeFrameExtras(project22316.geometry, project22316.frames));
    expect(items["ПС 145х1,5"].cost).toBeCloseTo(120 * 450.45, 6);
    expect(items["Лист пл. оц. 1мм (тяж)"].cost).toBeCloseTo(31.68 * 782.8, 6);
    expect(items["ПШ 61х1"].cost).toBeCloseTo(61.6 * 200, 6);
  });

  it("only the flat sheet depends on frame count", () => {
    const one = byName(computeFrameExtras(project22316.geometry, 1));
    const eight = byName(computeFrameExtras(project22316.geometry, 8));
    expect(eight["Лист пл. оц. 1мм (тяж)"].count).toBeCloseTo(
      8 * one["Лист пл. оц. 1мм (тяж)"].count,
      9,
    );
    expect(eight["ПС 145х1,5"].count).toBe(one["ПС 145х1,5"].count);
    expect(eight["ПШ 61х1"].count).toBe(one["ПШ 61х1"].count);
  });

  it("totals are the sum of the item lines", () => {
    const result = computeFrameExtras(project22318.geometry, project22318.frames);
    expect(result.totalMass_kg).toBeCloseTo(
      result.items.reduce((s, i) => s + i.count * i.unitMass_kg, 0),
      9,
    );
    expect(result.totalCost).toBeCloseTo(
      result.items.reduce((s, i) => s + i.count * i.unitPrice, 0),
      9,
    );
  });
});
