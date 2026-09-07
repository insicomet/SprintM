import { describe, expect, it } from "vitest";
import { selectSecondaryMembers, type SecondaryMembersInput } from "./secondaryMembers";
import type { Span } from "../../types/common";

/**
 * Эталон снят с пересчитанных книг подборщика: два реальных проекта и
 * четыре выдуманных (см. scripts/oracle). Порядок строк — как в
 * подборщике, лист «вывод», C36:E41.
 */
const cases: {
  name: string;
  input: SecondaryMembersInput;
  engine: [string, string][]; // [сечение, сталь] для строк 36–41
}[] = [
  {
    name: "«22316» — 18×30, h5, шаг 4,5, снег IV",
    input: { span_m: 18, length_m: 30, height_m: 5, framePitch_m: 4.5, snowDistrict: "IV" },
    engine: [
      ["┘└2уг. 63х5", "С345"], ["┘└2уг. 63х5", "С345"],
      ["80х3", "С245"], ["80х3", "С245"], ["80х3", "С245"], ["кв. 160х4", "С245"],
    ],
  },
  {
    name: "«22318» — 15×24, h5, шаг 4, снег IV",
    input: { span_m: 15, length_m: 24, height_m: 5, framePitch_m: 4, snowDistrict: "IV" },
    engine: [
      ["┘└2уг. 63х5", "С345"], ["┘└2уг. 63х5", "С345"],
      ["60х3", "С245"], ["80х3", "С245"], ["80х3", "С245"], ["кв. 160х4", "С245"],
    ],
  },
  {
    name: "A · Тюмень — 21×36, h6, шаг 3, снег IV",
    input: { span_m: 21, length_m: 36, height_m: 6, framePitch_m: 3, snowDistrict: "IV" },
    engine: [
      ["┘└2уг. 75х5", "С345"], ["┘└2уг. 75х5", "С345"],
      ["60х3", "С245"], ["80х3", "С245"], ["80х3", "С245"], ["кв. 160х4", "С245"],
    ],
  },
  {
    name: "B · Курган — 15×42, h4,5, шаг 6, снег III",
    input: { span_m: 15, length_m: 42, height_m: 4.5, framePitch_m: 6, snowDistrict: "III" },
    engine: [
      ["┘└2уг. 63х5", "С345"], ["┘└2уг. 63х5", "С345"],
      ["80х3", "С245"], ["80х3", "С245"], ["80х3", "С245"], ["кв. 160х4", "С245"],
    ],
  },
  {
    name: "D · Омск — 12×24, h4, шаг 6, снег III",
    input: { span_m: 12, length_m: 24, height_m: 4, framePitch_m: 6, snowDistrict: "III" },
    engine: [
      ["┘└2уг. 63х5", "С345"], ["┘└2уг. 63х5", "С345"],
      ["80х3", "С245"], ["80х3", "С245"], ["80х3", "С245"], ["кв. 160х4", "С245"],
    ],
  },
];

for (const { name, input, engine } of cases) {
  it(`reproduces the engine's secondary sections for ${name}`, () => {
    const rows = selectSecondaryMembers(input).derived;
    expect(rows.map((r) => [r.section, r.steel])).toEqual(engine);
  });
}

describe("C · Новосибирск — 24×30, h7, шаг 3,75, снег IV", () => {
  const input: SecondaryMembersInput = {
    span_m: 24, length_m: 30, height_m: 7, framePitch_m: 3.75, snowDistrict: "IV",
  };
  const rows = selectSecondaryMembers(input).derived;
  const by = (name: string) => rows.find((r) => r.name === name)!;

  it("switches the ties to 75х5 and the steel to С345 past 21 m", () => {
    expect(by("Затяжки").section).toBe("┘└2уг. 75х5");
    expect(by("Распорки").steel).toBe("С345");
  });

  it("asks for 100х3 horizontal bracing — the 80х3 of every shorter span is not enough", () => {
    expect(by("Связи горизонтальные").section).toBe("100х3");
    // Вертикальные при этом остаются 80х3: в источнике их условие
    // смотрит на длину здания (30 > 21), а не на пролёт.
    expect(by("Связи вертикальные").section).toBe("80х3");
  });

  it("says plainly that it cannot name the facade post past 21 m", () => {
    // Подборщик берёт её из собственного расчёта на листе «24м»
    // (для этого проекта — 150х4), который мы ещё не разбирали.
    expect(by("Стойки фахверка").section).toBeNull();
    expect(by("Стойки фахверка").missing).toMatch(/24м/);
  });
});

describe("правила, которых нет ни в одном из шести проектов", () => {
  const base: SecondaryMembersInput = {
    span_m: 24, length_m: 30, height_m: 7, framePitch_m: 3.75, snowDistrict: "IV",
  };
  const section = (input: SecondaryMembersInput, name: string) =>
    selectSecondaryMembers(input).derived.find((r) => r.name === name)!.section;

  it("keeps the light ties in snow districts I and II even past 21 m", () => {
    expect(section({ ...base, snowDistrict: "I" }, "Затяжки")).toBe("┘└2уг. 63х5");
    expect(section({ ...base, snowDistrict: "II" }, "Затяжки")).toBe("┘└2уг. 63х5");
  });

  it("goes to 120х3 horizontal bracing when the frame pitch passes 4 m", () => {
    expect(section({ ...base, framePitch_m: 4 }, "Связи горизонтальные")).toBe("100х3");
    expect(section({ ...base, framePitch_m: 4.5 }, "Связи горизонтальные")).toBe("120х3");
  });

  it("takes the vertical bracing off 80х3 only on a building shorter than 21 m", () => {
    expect(section({ ...base, length_m: 18, framePitch_m: 3.75 }, "Связи вертикальные")).toBe("100х3");
    expect(section({ ...base, length_m: 18, framePitch_m: 5 }, "Связи вертикальные")).toBe("120х3");
  });

  it("drops the facade post to 120х4 below 3 m", () => {
    expect(section({ ...base, span_m: 18 as Span, height_m: 2.8 }, "Стойки фахверка")).toBe("кв. 120х4");
  });

  it("puts every brace on 100х3/120х4 for the trussed variant", () => {
    const t = { ...base, trussedVariant: true };
    expect(section(t, "Распорки")).toBe("100х3");
    expect(section(t, "Связи горизонтальные")).toBe("120х4");
    expect(section(t, "Связи вертикальные")).toBe("120х4");
  });
});
