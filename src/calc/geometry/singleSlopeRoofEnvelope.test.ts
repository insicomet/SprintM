import { describe, expect, it } from "vitest";
import { computeSingleSlopeRoofEnvelope } from "./singleSlopeRoofEnvelope";

/** Сверка на четырёх реальных объектах — см. докстринг singleSlopeRoofEnvelope.ts. */
describe("computeSingleSlopeRoofEnvelope", () => {
  function get(items: ReturnType<typeof computeSingleSlopeRoofEnvelope>, name: string) {
    return items.find((i) => i.name === name)?.quantity;
  }

  it("«21851» (12×30×7,5, 8 рам)", () => {
    const items = computeSingleSlopeRoofEnvelope({ span_m: 12, length_m: 30, lowHeight_m: 7.5, frameCount: 8 });
    expect(get(items, "ГВЛ + на рамы")).toBeCloseTo(550, 9);
    expect(get(items, "Саморез 3,5х25")).toBeCloseTo(16500, 9);
    expect(get(items, "Фанера")).toBeCloseTo(270, 9);
    expect(get(items, "ИзоспанВ")).toBeCloseTo(450, 9);
    expect(get(items, "Изоспан АМ")).toBeCloseTo(450, 9);
    expect(get(items, "Воронки вн. вод")).toBeCloseTo(15, 9);
  });

  it("«21777» (12×36×4,5, 7 рам)", () => {
    const items = computeSingleSlopeRoofEnvelope({ span_m: 12, length_m: 36, lowHeight_m: 4.5, frameCount: 7 });
    expect(get(items, "ГВЛ + на рамы")).toBeCloseTo(376.25, 9);
    expect(get(items, "Саморез 3,5х25")).toBeCloseTo(11287.5, 9);
    expect(get(items, "Фанера")).toBeCloseTo(324, 9);
    expect(get(items, "ИзоспанВ")).toBeCloseTo(540, 9);
  });

  it("«22295» (8×24×8, 5 рам)", () => {
    const items = computeSingleSlopeRoofEnvelope({ span_m: 8, length_m: 24, lowHeight_m: 8, frameCount: 5 });
    expect(get(items, "ГВЛ + на рамы")).toBeCloseTo(306.25, 9);
    expect(get(items, "Саморез 3,5х25")).toBeCloseTo(9187.5, 9);
    expect(get(items, "Фанера")).toBeCloseTo(216, 9);
  });

  it("«22236» (8,5×50×4, 10 рам)", () => {
    const items = computeSingleSlopeRoofEnvelope({ span_m: 8.5, length_m: 50, lowHeight_m: 4, frameCount: 10 });
    expect(get(items, "ГВЛ + на рамы")).toBeCloseTo(425, 9);
    expect(get(items, "Саморез 3,5х25")).toBeCloseTo(12750, 9);
    expect(get(items, "Фанера")).toBeCloseTo(450, 9);
    expect(get(items, "ИзоспанВ")).toBeCloseTo(531.25, 9);
  });
});
