import { describe, expect, it } from "vitest";
import { computePurlinLayout } from "./purlinLayout";
import { selectPurlin } from "./selectPurlin";
import type { PurlinSelectionInput } from "./types";

const project22316: PurlinSelectionInput = {
  span_m: 18,
  framePitch_m: 4.5,
  snowLoad_kPa: 1.5,
  roofingSelfWeight_kg_m2: 32.028,
  roofSlopeDeg: 15,
  gammaN: 1,
  maxStep_mm: 2150,
  snowGuardPurlin: true,
  family: "2ПС",
};

const project22318: PurlinSelectionInput = {
  span_m: 15,
  framePitch_m: 4,
  snowLoad_kPa: 1.8,
  roofingSelfWeight_kg_m2: 32.028,
  roofSlopeDeg: 15,
  gammaN: 1,
  maxStep_mm: 1900,
  snowGuardPurlin: false,
  family: "2ПС",
};

describe("computePurlinLayout", () => {
  it("reproduces the purlin line of real project '22316': 780 п.м., 3174,6 кг", () => {
    const purlin = selectPurlin(project22316, 30)!;
    const layout = computePurlinLayout(purlin, 18, 30, { snowGuardPurlin: true });

    expect(layout.totalProfileLength_m).toBeCloseTo(780, 9);
    expect(layout.totalMass_kg).toBeCloseTo(3174.6, 6);
    // Крепёж кровельных панелей расчётчик считал по 12 прогонам.
    expect(layout.lineCount).toBe(12);
  });

  it("reproduces the purlin line of real project '22318': 480 п.м., 1699,2 кг", () => {
    const purlin = selectPurlin(project22318, 24)!;
    const layout = computePurlinLayout(purlin, 15, 24, { snowGuardPurlin: false });

    expect(layout.totalProfileLength_m).toBeCloseTo(480, 9);
    expect(layout.totalMass_kg).toBeCloseTo(1699.2, 6);
    expect(layout.lineCount).toBe(10);
  });

  it("the building mass matches what the selection itself reports", () => {
    const purlin = selectPurlin(project22316, 30)!;
    const layout = computePurlinLayout(purlin, 18, 30, { snowGuardPurlin: true });
    expect(layout.totalMass_kg).toBeCloseTo(purlin.massPerBuilding_kg, 6);
  });

  it("prices the purlins exactly as the estimator did in both projects", () => {
    // "22316": 780 п.м. × 575 ₽ = 448 500 ₽ (ведомость, F24)
    const a = selectPurlin(project22316, 30)!;
    expect(computePurlinLayout(a, 18, 30, { snowGuardPurlin: true }).totalCost).toBeCloseTo(
      448500,
      6,
    );
    // "22318": 480 п.м. × 508 ₽ = 243 840 ₽
    const b = selectPurlin(project22318, 24)!;
    expect(computePurlinLayout(b, 15, 24, { snowGuardPurlin: false }).totalCost).toBeCloseTo(
      243840,
      6,
    );
  });

  it("more lines are needed for a smaller step", () => {
    const purlin = selectPurlin(project22316, 30)!;
    const wide = computePurlinLayout(purlin, 18, 30, { snowGuardPurlin: true });
    const narrow = computePurlinLayout(
      { ...purlin, step_mm: purlin.step_mm / 2 },
      18,
      30,
      { snowGuardPurlin: true },
    );
    expect(narrow.lineCount).toBeGreaterThan(wide.lineCount);
    expect(narrow.totalProfileLength_m).toBeGreaterThan(wide.totalProfileLength_m);
  });
});
