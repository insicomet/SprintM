import { describe, expect, it } from "vitest";
import {
  columnLengthPerFrame_m,
  computeFrameCount,
  rafterLengthPerFrame_m,
} from "./frameGeometry";

describe("computeFrameCount", () => {
  it("matches the reference example: length 30m, pitch 4.5m -> 8 frames (I17 in file 22316)", () => {
    // CEILING(30/4.5+1, 1) = CEILING(7.667, 1) = 8
    expect(computeFrameCount({ length_m: 30, framePitch_m: 4.5 })).toBe(8);
  });

  it("gives exactly (length/pitch + 1) frames for an exact multiple", () => {
    expect(computeFrameCount({ length_m: 24, framePitch_m: 6 })).toBe(5);
  });

  describe("с раздвинутыми под ворота пролётами", () => {
    // «21755»: шаг рам 4,4, а 4,8 — шаг у ворот (ширина 4 м, раздвинуто
    // до 4+0,8). Раздвинутый пролёт заменяет один стандартный шаг, а не
    // добавляется поверх — тот же остаток длины делится дальше как обычно.
    it("считает раздвинутый пролёт вместо одного стандартного шага", () => {
      const withoutGate = computeFrameCount({ length_m: 60, framePitch_m: 4.4 });
      const withGate = computeFrameCount({ length_m: 60, framePitch_m: 4.4 }, [4.8]);
      // Один шаг стал длиннее — суммарная длина та же, а не (длина + 4,8).
      expect(withGate).toBeLessThanOrEqual(withoutGate);
    });

    it("не меняет результат для пустого списка раздвинутых пролётов", () => {
      expect(computeFrameCount({ length_m: 30, framePitch_m: 4.5 }, [])).toBe(
        computeFrameCount({ length_m: 30, framePitch_m: 4.5 }),
      );
    });

    it("учитывает несколько раздвинутых пролётов", () => {
      // 24 м, шаг 6 -> 5 рам без ворот. Два раздвинутых пролёта по 6,8 м
      // (не длиннее шага) съедают 13,6 м, остаток 10,4 м -> ceil(10,4/6)=2
      // стандартных шага + 2 раздвинутых + 1 = 5.
      expect(computeFrameCount({ length_m: 24, framePitch_m: 6 }, [6.8, 6.8])).toBe(5);
    });
  });
});

describe("rafterLengthPerFrame_m", () => {
  it("equals span/cos(slope), using the source's own 3.14 for π", () => {
    // Исходник переводит уклон в радианы как "15*3.14/180" (J14), давая
    // cos = 0,9659601685 вместо 0,9659258263. Воспроизводим, чтобы длины
    // совпадали с ведомостью; расхождение с настоящим π — 0,004%.
    const result = rafterLengthPerFrame_m({ span_m: 18, roofSlopeDeg: 15 });
    expect(result).toBeCloseTo(18 / Math.cos((15 * 3.14) / 180), 9);
    expect(result).toBeCloseTo(18 / Math.cos((15 * Math.PI) / 180), 2);
  });

  it("equals the span itself for a flat roof (0°)", () => {
    expect(rafterLengthPerFrame_m({ span_m: 18, roofSlopeDeg: 0 })).toBeCloseTo(18, 9);
  });
});

describe("columnLengthPerFrame_m", () => {
  it("is twice (height - 0.07)", () => {
    expect(columnLengthPerFrame_m({ height_m: 5 })).toBeCloseTo(2 * (5 - 0.07), 9);
  });
});
