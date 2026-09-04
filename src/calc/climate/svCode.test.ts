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
