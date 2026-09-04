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
    it("snaps up to the nearest available bucket for spans 9-21m", () => {
      expect(snapHeight(12, 3.6)).toBe(3.6);
      expect(snapHeight(12, 3.7)).toBe(4.8);
      expect(snapHeight(12, 5.0)).toBe(6.0);
    });

    it("snaps within the 24m span's own bucket list", () => {
      expect(snapHeight(24, 6.0)).toBe(6);
      expect(snapHeight(24, 6.5)).toBe(7);
      expect(snapHeight(24, 9.0)).toBe(9);
    });

    it("throws when height exceeds the largest bucket", () => {
      expect(() => snapHeight(12, 6.1)).toThrow();
      expect(() => snapHeight(24, 9.1)).toThrow();
    });
  });
});
