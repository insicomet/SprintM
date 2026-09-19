import { describe, expect, it } from "vitest";
import { computeSingleSlopeFrameFasteners } from "./singleSlopeFrameFasteners";

/**
 * Сверка на всех шести реальных объектах, использованных для
 * singleSlopeBracing.ts — формула сходится без единого отклонения,
 * включая доп-слагаемое болтов М16, которое зависит от той же границы
 * «высокий/низкий», что и коэффициент вертикальных связей.
 */
describe("computeSingleSlopeFrameFasteners", () => {
  it("«21851» (12×30×7,5, 8 рам) — высокий случай", () => {
    const r = computeSingleSlopeFrameFasteners(12, 30, 7.5, 8);
    expect(r.items.find((i) => i.name === "Саморез 5,5x25")?.count).toBeCloseTo(4240, 9);
    expect(r.items.find((i) => i.name === "Дюбель-гвоздь 6х60")?.count).toBeCloseTo(169, 9);
    expect(r.items.find((i) => i.name === "Болт М12х40")?.count).toBeCloseTo(128, 9);
    expect(r.items.find((i) => i.name === "Гайка М12")?.count).toBeCloseTo(256, 9);
    expect(r.items.find((i) => i.name === "Шайба 12")?.count).toBeCloseTo(128, 9);
    expect(r.items.find((i) => i.name === "Болт М16х50")?.count).toBeCloseTo(2420, 9);
  });

  it("«21777» (12×36×4,5, 7 рам) — низкий случай", () => {
    const r = computeSingleSlopeFrameFasteners(12, 36, 4.5, 7);
    expect(r.items.find((i) => i.name === "Саморез 5,5x25")?.count).toBeCloseTo(3710, 9);
    expect(r.items.find((i) => i.name === "Болт М16х50")?.count).toBeCloseTo(2098, 9);
  });

  it("«21510» (11,6×36×3,6, 7 рам) — низкий случай", () => {
    const r = computeSingleSlopeFrameFasteners(11.6, 36, 3.6, 7);
    expect(r.items.find((i) => i.name === "Болт М16х50")?.count).toBeCloseTo(2098, 9);
  });

  it("«22295» (8×24×8, 5 рам) — высокий случай", () => {
    const r = computeSingleSlopeFrameFasteners(8, 24, 8, 5);
    expect(r.items.find((i) => i.name === "Саморез 5,5x25")?.count).toBeCloseTo(2650, 9);
    expect(r.items.find((i) => i.name === "Болт М16х50")?.count).toBeCloseTo(1526.0000000000002, 6);
  });

  it("«22271» (8×20×8, 5 рам) — высокий случай", () => {
    const r = computeSingleSlopeFrameFasteners(8, 20, 8, 5);
    expect(r.items.find((i) => i.name === "Болт М16х50")?.count).toBeCloseTo(1526.0000000000002, 6);
  });

  it("«22236» (8,5×50×4, 10 рам) — низкий (граничный) случай", () => {
    const r = computeSingleSlopeFrameFasteners(8.5, 50, 4, 10);
    expect(r.items.find((i) => i.name === "Саморез 5,5x25")?.count).toBeCloseTo(5300, 9);
    expect(r.items.find((i) => i.name === "Болт М12х40")?.count).toBeCloseTo(160, 9);
    expect(r.items.find((i) => i.name === "Гайка М12")?.count).toBeCloseTo(320, 9);
    expect(r.items.find((i) => i.name === "Болт М16х50")?.count).toBeCloseTo(2992, 6);
  });
});
