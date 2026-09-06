import { describe, expect, it } from "vitest";
import { computeDrainage } from "./drainage";

/** Реальный проект "22316": пролёт 18, длина 30, высота 5. */
const project22316 = { span_m: 18, length_m: 30, height_m: 5 };
/** Реальный проект "22318": пролёт 15, длина 24, высота 5. */
const project22318 = { span_m: 15, length_m: 24, height_m: 5 };

function itemNamed(takeoff: ReturnType<typeof computeDrainage>, name: string) {
  const item = takeoff.items.find((i) => i.name === name);
  if (!item) throw new Error(`нет позиции ${name}`);
  return item;
}

describe("computeDrainage", () => {
  it("reproduces every quantity of real project '22316'", () => {
    const result = computeDrainage(project22316);
    expect(itemNamed(result, "Труба").count).toBe(30);
    expect(itemNamed(result, "Желоб").count).toBe(60);
    expect(itemNamed(result, "Держатель трубы").count).toBe(15);
    expect(itemNamed(result, "Держатель желоба").count).toBeCloseTo(85.714286, 5);
    expect(itemNamed(result, "Заглушка желоба").count).toBe(4);
    expect(itemNamed(result, "Колено сливное").count).toBe(6);
    expect(itemNamed(result, "Колено угловое").count).toBe(12);
    expect(itemNamed(result, "Соединитель желоба").count).toBe(12);
    expect(itemNamed(result, "Патрубок").count).toBe(6);
  });

  it("reproduces every quantity of real project '22318'", () => {
    const result = computeDrainage(project22318);
    expect(itemNamed(result, "Труба").count).toBe(20);
    expect(itemNamed(result, "Желоб").count).toBe(48);
    expect(itemNamed(result, "Держатель трубы").count).toBe(10);
    expect(itemNamed(result, "Держатель желоба").count).toBeCloseTo(68.571429, 5);
    expect(itemNamed(result, "Заглушка желоба").count).toBe(4);
    expect(itemNamed(result, "Колено сливное").count).toBe(4);
    expect(itemNamed(result, "Колено угловое").count).toBe(8);
    expect(itemNamed(result, "Соединитель желоба").count).toBeCloseTo(9.6, 9);
    expect(itemNamed(result, "Патрубок").count).toBe(4);
  });

  it("reproduces the totals of real project '22316' (F70 and G70)", () => {
    const result = computeDrainage(project22316);
    expect(result.totalCost).toBeCloseTo(92971.10571428572, 6);
    expect(result.totalMass_kg).toBeCloseTo(205.35714285714286, 9);
  });

  it("reproduces the totals of real project '22318' (F70 and G70)", () => {
    const result = computeDrainage(project22318);
    expect(result.totalCost).toBeCloseTo(69922.74857142857, 6);
    expect(result.totalMass_kg).toBeCloseTo(156.0857142857143, 9);
  });

  it("applies the 2% overhead on top of the item subtotal", () => {
    const result = computeDrainage(project22316);
    expect(result.overheadCost).toBeCloseTo(result.subtotalCost * 0.02, 9);
    expect(result.totalCost).toBeCloseTo(result.subtotalCost + result.overheadCost, 9);
  });

  it("rounds the outlet elbow count up to a multiple of 2, like Excel CEILING(x,2)", () => {
    // 18*30/100 = 5.4 -> 6;  15*24/100 = 3.6 -> 4;  ровно 4.0 остаётся 4
    expect(itemNamed(computeDrainage(project22316), "Колено сливное").count).toBe(6);
    expect(itemNamed(computeDrainage(project22318), "Колено сливное").count).toBe(4);
    expect(
      itemNamed(computeDrainage({ span_m: 20, length_m: 20, height_m: 5 }), "Колено сливное").count,
    ).toBe(4);
  });
});
