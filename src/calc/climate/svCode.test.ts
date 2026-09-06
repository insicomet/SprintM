import { describe, expect, it } from "vitest";
import {
  computeSvCode,
  findSettlement,
  findSettlementsByName,
  getAllSettlementNames,
  normalizeSvCode,
  romanDistrictToDigit,
} from "./svCode";

describe("climate / svCode", () => {
  it("finds a known settlement", () => {
    const city = findSettlement("Челябинск");
    expect(city).toBeDefined();
    expect(city?.snow.region).toBe("III");
    expect(city?.wind.region).toBe("II");
  });

  it("returns undefined for a settlement that is genuinely absent", () => {
    expect(findSettlement("Урюпинск-на-Марсе")).toBeUndefined();
  });

  describe("matches ё and е", () => {
    // В справочнике город записан как "Берёзовский", а в исходных файлах
    // ИНСИ и при ручном вводе — "Березовский", из-за чего он не находился.
    it("finds Берёзовский when typed with е", () => {
      const city = findSettlement("Березовский");
      expect(city).toBeDefined();
      expect(city?.settlement).toBe("Берёзовский");
    });

    it("still finds it when typed with ё", () => {
      expect(findSettlement("Берёзовский")?.settlement).toBe("Берёзовский");
    });
  });

  describe("same-named settlements", () => {
    it("reports every Берёзовский in the reference", () => {
      const all = findSettlementsByName("Березовский");
      expect(all.length).toBe(2);
      expect(all.map((c) => c.region).sort()).toEqual([
        "Кемеровская область",
        "Свердловская область",
      ]);
    });

    it("picks one by the qualified 'Город, Регион' form", () => {
      const sverdlovsk = findSettlement("Берёзовский, Свердловская область");
      expect(sverdlovsk?.snow.region).toBe("III");
      expect(sverdlovsk?.snow.sgKpa).toBe(1.5);
      expect(sverdlovsk?.wind.region).toBe("I");

      const kemerovo = findSettlement("Березовский, Кемеровская область");
      expect(kemerovo?.snow.region).toBe("IV");
      expect(kemerovo?.wind.region).toBe("III");
    });

    it("offers same-named settlements qualified in the autocomplete list", () => {
      const names = getAllSettlementNames();
      expect(names).toContain("Берёзовский, Свердловская область");
      expect(names).toContain("Берёзовский, Кемеровская область");
      expect(names).not.toContain("Берёзовский");
      // Уникальные названия остаются простыми.
      expect(names).toContain("Челябинск");
    });
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
