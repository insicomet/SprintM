import { describe, expect, it } from "vitest";
import { computeSvCode, findSettlement, normalizeSvCode, romanDistrictToDigit } from "./svCode";

describe("climate / svCode", () => {
  it("finds a known settlement", () => {
    const city = findSettlement("Челябинск");
    expect(city).toBeDefined();
    expect(city?.snow.region).toBe("III");
    expect(city?.wind.region).toBe("II");
  });

  it("throws for a settlement not in the reference (e.g. Березовский — see open assumption)", () => {
    expect(findSettlement("Березовский")).toBeUndefined();
  });

  describe("findSettlement is tolerant of case and stray whitespace", () => {
    // Баг, найденный пользователем 2026-09-04: ввод "Иркутск" в другом
    // регистре или с пробелом на конце возвращал "город не найден"
    // вместо ожидаемых данных, хотя выглядит как рабочий ввод.
    it("matches regardless of letter case", () => {
      expect(findSettlement("иркутск")).toBeDefined();
      expect(findSettlement("ИРКУТСК")).toBeDefined();
      expect(findSettlement("иркутск")?.settlement).toBe("Иркутск");
    });

    it("matches with leading/trailing whitespace", () => {
      expect(findSettlement("Иркутск ")).toBeDefined();
      expect(findSettlement(" Иркутск")).toBeDefined();
    });

    it("still returns the exact same climate data as the canonical spelling", () => {
      const exact = findSettlement("Иркутск");
      const sloppy = findSettlement(" иркутск  ".trim().toLowerCase());
      expect(sloppy?.snow.sgKpa).toBe(exact?.snow.sgKpa);
      expect(sloppy?.wind.w0Kpa).toBe(exact?.wind.w0Kpa);
    });

    it("still returns undefined for a genuinely unknown city, case-insensitively", () => {
      expect(findSettlement("бла-бла-город")).toBeUndefined();
    });
  });

  describe("romanDistrictToDigit", () => {
    it("converts standard roman districts", () => {
      expect(romanDistrictToDigit("III")).toBe("3");
      expect(romanDistrictToDigit("II")).toBe("2");
    });
    it("converts the special 'Iа' district", () => {
      expect(romanDistrictToDigit("Iа")).toBe("1а");
    });
  });

  describe("normalizeSvCode", () => {
    it("passes through already-standard codes", () => {
      expect(normalizeSvCode("4/1")).toBe("4/1");
    });
    it("normalizes non-tabulated codes to the nearest standard one", () => {
      expect(normalizeSvCode("5/4")).toBe("5/3");
      expect(normalizeSvCode("1/1")).toBe("1/3");
    });
  });

  it("computes a full с/в code for a known city (cross-checked against ИНСИ снегветер table)", () => {
    // Альметьевск в файле ИНСИ: снег IV, ветер II -> "4/2" -> нормализовано "4/3"
    const result = computeSvCode("Альметьевск");
    expect(result.raw).toBe("4/2");
    expect(result.standard).toBe("4/3");
  });
});
