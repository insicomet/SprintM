import { describe, expect, it } from "vitest";
import { parseOpeningsLine, parseTz, spanForWidth } from "./parseTz";
import { TZ_22326 as tz22326 } from "./tz22326.fixture";
import { TZ_22326_PDFJS } from "./tz22326.pdfjs.fixture";

describe("parseOpeningsLine", () => {
  it("reads a line with several sizes and counts", () => {
    expect(parseOpeningsLine("1х3м - 2 шт, 1х3,5 - 1 шт, 1х6м - 2 шт")).toEqual([
      { width_m: 1, height_m: 3, count: 2 },
      { width_m: 1, height_m: 3.5, count: 1 },
      { width_m: 1, height_m: 6, count: 2 },
    ]);
  });

  it("defaults the count to one when it is not written", () => {
    expect(parseOpeningsLine("2,5х2,5")).toEqual([{ width_m: 2.5, height_m: 2.5, count: 1 }]);
  });

  it("accepts a latin x and a multiplication sign", () => {
    expect(parseOpeningsLine("4x4,2 - 2 шт")[0]).toEqual({ width_m: 4, height_m: 4.2, count: 2 });
    expect(parseOpeningsLine("3×3")[0]).toEqual({ width_m: 3, height_m: 3, count: 1 });
  });
});

describe("spanForWidth", () => {
  it("takes the nearest standard span not narrower than the building", () => {
    expect(spanForWidth(10.4)).toBe(12);
    expect(spanForWidth(11)).toBe(12);
    expect(spanForWidth(12)).toBe(12);
    expect(spanForWidth(12.1)).toBe(15);
    expect(spanForWidth(25)).toBeUndefined();
  });
});

describe("parseTz — настоящее ТЗ 22326", () => {
  const tz = parseTz(tz22326);

  it("reads the header and the site", () => {
    expect(tz.number).toBe("22326");
    expect(tz.city).toBe("Увильды");
    expect(tz.title).toMatch(/10,4х25,7х4/);
  });

  it("reads the size and rounds the width up to a standard span", () => {
    expect(tz.width_m).toBe(11);
    expect(tz.length_m).toBe(26);
    expect(tz.height_m).toBe(4);
    expect(tz.span).toBe(12);
    expect(tz.notes.some((n) => n.includes("11 м"))).toBe(true);
  });

  it("reads the insulation as the panel thickness", () => {
    expect(tz.wallInsulation_mm).toBe(150);
    expect(tz.roofInsulation_mm).toBe(150);
  });

  it("reads every opening, all sizes of them", () => {
    expect(tz.gates).toEqual([{ width_m: 2.5, height_m: 2.5, count: 1 }]);
    expect(tz.doors).toEqual([
      { width_m: 1, height_m: 2.1, count: 1 },
      { width_m: 1.6, height_m: 2.1, count: 1 },
    ]);
    expect(tz.windows).toEqual([
      { width_m: 1, height_m: 3, count: 2 },
      { width_m: 1, height_m: 3.5, count: 1 },
      { width_m: 1, height_m: 6, count: 2 },
    ]);
  });

  it("reads the responsibility level and the drainage line", () => {
    expect(tz.gammaN).toBe(1.0);
    expect(tz.drainageAndSnowGuards).toBe(true);
  });

  it("reads it whole — nothing is left unread", () => {
    expect(tz.unread).toEqual([]);
  });

  it("carries the customer's own paragraph across instead of dropping it", () => {
    expect(tz.notes.some((n) => n.includes("навес"))).toBe(true);
  });
});

describe("parseTz — чего в задании нет", () => {
  it("names the missing items rather than filling them in silently", () => {
    const tz = parseTz("Расчет № 1 от 01 января 2026\nТЕХНИЧЕСКОЕ ЗАДАНИЕ\n");
    expect(tz.unread).toContain("место строительства");
    expect(tz.unread).toContain("ширина здания");
    expect(tz.unread).toContain("длина здания");
    expect(tz.gates).toEqual([]);
  });

  it("says so when the building is wider than the widest span", () => {
    const tz = parseTz("3. Размеры здания (м):\nШирина\n30\nДлина\n40\n");
    expect(tz.span).toBeUndefined();
    expect(tz.unread.some((u) => u.includes("30 м"))).toBe(true);
  });
});

describe("parseTz — то же ТЗ, но текстовым слоем pdf.js", () => {
  // В браузере текст снимает pdf.js, и раскладка у него другая: подписи
  // пунктов переносятся, значение уходит на строку-другую ниже. Ответ
  // должен получаться тот же.
  const byPdfjs = parseTz(TZ_22326_PDFJS);
  const byPdftotext = parseTz(tz22326);

  it("reads the same building and the same site", () => {
    expect(byPdfjs.city).toBe("Увильды");
    expect(byPdfjs.width_m).toBe(11);
    expect(byPdfjs.length_m).toBe(26);
    expect(byPdfjs.height_m).toBe(4);
    expect(byPdfjs.span).toBe(12);
    expect(byPdfjs.number).toBe("22326");
  });

  it("reads the same insulation, openings and drainage", () => {
    expect(byPdfjs.wallInsulation_mm).toBe(150);
    expect(byPdfjs.roofInsulation_mm).toBe(150);
    expect(byPdfjs.gates).toEqual(byPdftotext.gates);
    expect(byPdfjs.doors).toEqual(byPdftotext.doors);
    expect(byPdfjs.windows).toEqual(byPdftotext.windows);
    expect(byPdfjs.drainageAndSnowGuards).toBe(true);
  });

  it("leaves nothing unread either", () => {
    expect(byPdfjs.unread).toEqual([]);
  });
});
