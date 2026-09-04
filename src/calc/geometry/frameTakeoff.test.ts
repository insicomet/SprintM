import { describe, expect, it } from "vitest";
import { findFrameSelection } from "../frame/sectionBank";
import { computeFrameTakeoff } from "./frameTakeoff";

describe("computeFrameTakeoff", () => {
  const geometry = {
    span_m: 12,
    length_m: 30,
    height_m: 3.6,
    framePitch_m: 6,
    roofSlopeDeg: 15,
  };

  it("computes a full takeoff for a fully-priced frame selection (12м, с/в=2/3, h=3.6, k=1.0)", () => {
    const selection = findFrameSelection({
      span: 12,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "2/3",
    });
    expect(selection).toBeDefined();

    const takeoff = computeFrameTakeoff(geometry, selection!);

    expect(takeoff.frameCount).toBe(6); // CEILING(30/6+1,1) = 6
    expect(takeoff.column.profileName).toBe("ПГС300/20х80х1,5");
    expect(takeoff.beam.profileName).toBe("ПГС300/20х80х2");

    // Длина: 6 рам * 2 * (3.6 - 0.07) = 42.36 м колонн
    expect(takeoff.column.totalLength_m).toBeCloseTo(6 * 2 * (3.6 - 0.07), 6);
    // Масса известна из прайс-листа -> не null
    expect(takeoff.column.massPerM_kg).not.toBeNull();
    expect(takeoff.beam.massPerM_kg).not.toBeNull();
    expect(takeoff.totalFrameMass_kg).not.toBeNull();
    expect(takeoff.totalFrameMass_kg!).toBeGreaterThan(0);
  });

  it("total mass equals the sum of column and beam mass", () => {
    const selection = findFrameSelection({
      span: 12,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "2/3",
    });
    const takeoff = computeFrameTakeoff(geometry, selection!);
    expect(takeoff.totalFrameMass_kg).toBeCloseTo(
      takeoff.column.totalMass_kg! + takeoff.beam.totalMass_kg!,
      9,
    );
  });

  it("gracefully returns null mass (not a crash) when the price list has no matching thickness", () => {
    // с/в=4/1 подбирает балку ПГС300/20х80х3 — толщины 3мм для сечения
    // 300х80 в текущем прайс-листе (data/frame_profile_prices.json) нет
    // (максимум 2,5мм, и то только в П350) — это реальный пробел
    // прайса, не баг подбора: totalFrameMass_kg должен стать null, а
    // не упасть с ошибкой или молча посчитать неверную массу.
    const selection = findFrameSelection({
      span: 12,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "4/1",
    });
    const takeoff = computeFrameTakeoff(geometry, selection!);
    expect(takeoff.beam.massPerM_kg).toBeNull();
    expect(takeoff.beam.totalMass_kg).toBeNull();
    expect(takeoff.totalFrameMass_kg).toBeNull();
    // Колонна (1,5мм) при этом находится нормально.
    expect(takeoff.column.massPerM_kg).not.toBeNull();
  });
});
