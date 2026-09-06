import { describe, expect, it } from "vitest";
import type { Span } from "../../types/common";
import { computeFrameFasteners } from "./frameFasteners";

interface ProjectInputs {
  span_m: Span;
  length_m: number;
  height_m: number;
}

/** Реальный проект "22316" (Березовский): пролёт 18, длина 30, высота 5, 8 рам. */
const project22316 = { geometry: { span_m: 18, length_m: 30, height_m: 5 } as ProjectInputs, frames: 8 };
/** Реальный проект "22318" (Сургут): пролёт 15, длина 24, высота 5, 7 рам. */
const project22318 = { geometry: { span_m: 15, length_m: 24, height_m: 5 } as ProjectInputs, frames: 7 };

function counts(geometry: ProjectInputs, frames: number) {
  const result = computeFrameFasteners(geometry, frames);
  return Object.fromEntries(result.items.map((i) => [i.name, i.count]));
}

describe("computeFrameFasteners", () => {
  it("reproduces every quantity of real project '22316'", () => {
    const c = counts(project22316.geometry, project22316.frames);
    expect(c["Фс11, Фс14"]).toBeCloseTo(373.33333, 4);
    expect(c["Фс12"]).toBeCloseTo(746.66667, 4);
    expect(c["Саморез 5,5x25"]).toBe(5072);
    expect(c["Дюбель-гвоздь 6х60"]).toBe(193);
    expect(c["Болт М12х40"]).toBe(128);
    expect(c["Гайка М12"]).toBe(128);
    expect(c["Шайба 12"]).toBe(128);
    expect(c["Болт М16х50"]).toBeCloseTo(2884, 6);
    expect(c["Гайка М16"]).toBeCloseTo(2884, 6);
    expect(c["Шайба 16 пруж"]).toBeCloseTo(2884, 6);
  });

  it("reproduces every quantity of real project '22318'", () => {
    const c = counts(project22318.geometry, project22318.frames);
    expect(c["Фс11, Фс14"]).toBeCloseTo(291.66667, 4);
    expect(c["Фс12"]).toBeCloseTo(583.33333, 4);
    expect(c["Саморез 5,5x25"]).toBe(4298);
    expect(c["Дюбель-гвоздь 6х60"]).toBe(157);
    expect(c["Болт М12х40"]).toBe(112);
    expect(c["Гайка М12"]).toBe(112);
    expect(c["Шайба 12"]).toBe(112);
    expect(c["Болт М16х50"]).toBeCloseTo(2202, 6);
    expect(c["Гайка М16"]).toBeCloseTo(2202, 6);
    expect(c["Шайба 16 пруж"]).toBeCloseTo(2202, 6);
  });

  it("reproduces the per-line cost of real project '22316'", () => {
    const result = computeFrameFasteners(project22316.geometry, project22316.frames);
    const byName = Object.fromEntries(result.items.map((i) => [i.name, i.cost]));
    // Значения ячеек F85..F95 исходной ведомости.
    expect(byName["Саморез 5,5x25"]).toBeCloseTo(11607.272, 6);
    expect(byName["Дюбель-гвоздь 6х60"]).toBeCloseTo(312.9495, 6);
    expect(byName["Болт М12х40"]).toBeCloseTo(1492.608, 6);
    expect(byName["Гайка М12"]).toBeCloseTo(656.512, 6);
    expect(byName["Шайба 12"]).toBeCloseTo(125.12, 6);
    expect(byName["Болт М16х50"]).toBeCloseTo(78769.25, 6);
    expect(byName["Гайка М16"]).toBeCloseTo(38505.726, 6);
    expect(byName["Шайба 16 пруж"]).toBeCloseTo(6865.362, 6);
  });

  it("prices Фс11/Фс14 and Фс12 at the rates cached in both projects", () => {
    const result = computeFrameFasteners(project22316.geometry, project22316.frames);
    const fc11 = result.items.find((i) => i.name === "Фс11, Фс14")!;
    const fc12 = result.items.find((i) => i.name === "Фс12")!;
    expect(fc11.unitPrice).toBe(291);
    expect(fc12.unitPrice).toBe(114);
    expect(fc11.cost).toBeCloseTo(fc11.count * 291, 6);
  });

  it("mass and cost totals are the sum of the item lines", () => {
    const result = computeFrameFasteners(project22318.geometry, project22318.frames);
    expect(result.totalMass_kg).toBeCloseTo(
      result.items.reduce((s, i) => s + i.count * i.unitMass_kg, 0),
      9,
    );
    expect(result.totalCost).toBeCloseTo(
      result.items.reduce((s, i) => s + i.count * i.unitPrice, 0),
      9,
    );
  });

  it("nuts and washers always match their bolt count", () => {
    const result = computeFrameFasteners({ span_m: 21, length_m: 48, height_m: 6 }, 13);
    const by = Object.fromEntries(result.items.map((i) => [i.name, i.count]));
    expect(by["Гайка М12"]).toBe(by["Болт М12х40"]);
    expect(by["Шайба 12"]).toBe(by["Болт М12х40"]);
    expect(by["Гайка М16"]).toBe(by["Болт М16х50"]);
    expect(by["Шайба 16 пруж"]).toBe(by["Болт М16х50"]);
  });

  it("flags spans other than 15 and 18 as unconfirmed, except the dowel", () => {
    const result = computeFrameFasteners({ span_m: 24, length_m: 48, height_m: 6 }, 13);
    for (const item of result.items) {
      expect(item.isEstimated).toBe(item.name !== "Дюбель-гвоздь 6х60");
    }
  });

  it("scales with frame count", () => {
    const one = computeFrameFasteners(project22316.geometry, 1);
    const eight = computeFrameFasteners(project22316.geometry, 8);
    const fc = (r: ReturnType<typeof computeFrameFasteners>) =>
      r.items.find((i) => i.name === "Фс11, Фс14")!.count;
    expect(fc(eight)).toBeCloseTo(fc(one) * 8, 6);
  });
});
