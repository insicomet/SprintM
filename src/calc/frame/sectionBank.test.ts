import { describe, expect, it } from "vitest";
import { findFrameSelection, getAllFrameSelections, snapHeight } from "./sectionBank";

describe("sectionBank", () => {
  it("loads all 396 extracted rows", () => {
    expect(getAllFrameSelections().length).toBe(396);
  });

  it("matches the known reference value: пролёт 12м, с/в=4/1, высота 3.6, k=1.0", () => {
    // Значения сверены вручную с исходным файлом ИНСИ (подбор!AG6:AG16 при вводе с/в=4/1).
    const result = findFrameSelection({
      span: 12,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "4/1",
    });
    expect(result).toBeDefined();
    expect(result?.column.profile).toBe("ПГС300/20х80х2");
    expect(result?.column.utilizationPercent).toBe(84);
    expect(result?.beam.profile).toBe("ПГС300/20х80х3");
    expect(result?.beam.utilizationPercent).toBe(82);
    expect(result?.purlin?.profile).toBe("2ТПС 200х65х2 (шаг 1,0м)");
    expect(result?.bolts.totalInFrame).toBe(268);
  });

  it("returns undefined for a combination that is not in the bank", () => {
    const result = findFrameSelection({
      span: 9,
      height_m: 3.6,
      responsibility: 1.0,
      svCode: "8/8",
    });
    expect(result).toBeUndefined();
  });

  describe("snapHeight", () => {
    // Пороги подбор!AN9:AN15 — на 0,2м выше самой корзины.
    it("maps height to a bucket by the source thresholds for spans 9-21m", () => {
      expect(snapHeight(12, 3.6)).toBe(3.6);
      expect(snapHeight(12, 3.8)).toBe(3.6);
      expect(snapHeight(12, 3.9)).toBe(4.8);
      expect(snapHeight(12, 5.0)).toBe(4.8);
      expect(snapHeight(12, 5.1)).toBe(6.0);
      expect(snapHeight(12, 6.2)).toBe(6.0);
    });

    it("puts a 5m building in the 4.8m bucket, as both real projects do", () => {
      expect(snapHeight(18, 5)).toBe(4.8);
      expect(snapHeight(15, 5)).toBe(4.8);
    });

    it("skips the two lowest buckets for the 24m span", () => {
      expect(snapHeight(24, 5)).toBe(6);
      expect(snapHeight(24, 6.2)).toBe(6);
      expect(snapHeight(24, 6.5)).toBe(7);
      expect(snapHeight(24, 9.0)).toBe(9);
    });

    it("throws when height exceeds the last threshold", () => {
      expect(() => snapHeight(12, 6.3)).toThrow();
      expect(() => snapHeight(24, 9.1)).toThrow();
    });
  });

  describe("reproduces the section choice of the two real projects", () => {
    it("project '22316' (Березовский): 18м, высота 5, с/в 4/1, k=0,8", () => {
      const result = findFrameSelection({ span: 18, height_m: 5, responsibility: 0.8, svCode: "4/1" });
      expect(result?.heightBucket).toBe(4.8);
      expect(result?.framePitch_m).toBe(4.5);
      expect(result?.column.profile).toBe("ПГС300/20х80х2,5");
      expect(result?.beam.profile).toBe("ПГС300/20х80х3");
    });

    it("project '22318' (Сургут): 15м, высота 5, с/в 4/1, k=1,0", () => {
      const result = findFrameSelection({ span: 15, height_m: 5, responsibility: 1.0, svCode: "4/1" });
      expect(result?.heightBucket).toBe(4.8);
      expect(result?.framePitch_m).toBe(4);
      expect(result?.column.profile).toBe("ПГС300/20х80х2");
      expect(result?.beam.profile).toBe("ПГС300/20х80х3");
    });
  });
});
