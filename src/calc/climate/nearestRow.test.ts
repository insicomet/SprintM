import { describe, expect, it } from "vitest";
import { pickBankBlock, selectBankBlock } from "./snowLadder";
import { normalizeSvCodeOrNearest, svCodeFromDistrictsOrNearest } from "./svCode";
import { resolveWindDistrict } from "./windDistrict";
import { findSettlement } from "./svCode";

/**
 * Ответ проектировщика на вопрос 04: города, для которых точной строки в
 * таблицах ИНСИ нет, «считать по ближайшей строке с пометкой „требует
 * проверки“». Здесь зафиксировано, что значит «ближайшая» в каждой из
 * трёх таблиц, которые могут не накрыть город.
 */
describe("расчёт по ближайшей строке", () => {
  describe("лестница нагрузок", () => {
    it("нагрузку выше последней ступени считает по последней", () => {
      // Южно-Сахалинск: 3,85 кПа снега, лестница кончается на 2,60.
      const pick = pickBankBlock(3.85, "С-П 150", 1.0)!;
      expect(pick.fallback).toEqual({ kind: "выше", threshold_kPa: 2.6 });
      expect(pick.block.snowDistrict).toBe("V");
      expect(pick.block.bankK).toBe(1);
      expect(pick.block.designLoad_kPa).toBe(2.5);
      // Искомая нагрузка сохраняется как есть — по ней видно, насколько
      // расчёт приблизителен: 3,95 против 2,5 несущей.
      expect(pick.block.lookupLoad_kPa).toBeCloseTo(3.95, 6);
    });

    it("нагрузку ниже первой ступени считает по первой", () => {
      const pick = pickBankBlock(0.2, "С-П 150", 1.0)!;
      expect(pick.fallback).toEqual({ kind: "ниже", threshold_kPa: 0.4 });
      expect(pick.block.snowDistrict).toBe("I");
    });

    it("точную ступень не помечает", () => {
      const pick = pickBankBlock(1.5, "С-П 150", 1.0)!;
      expect(pick.fallback).toBeNull();
      expect(pick.block.snowDistrict).toBe("IV");
    });

    it("без надбавки за покрытие подставлять нечего", () => {
      // Надбавка входит в саму искомую нагрузку — без неё нет и поиска.
      expect(pickBankBlock(1.5, "малоуклонная кровля с подв. п.", 1.0)).toBeNull();
    });

    it("строгий selectBankBlock по-прежнему отказывает на краях", () => {
      // Он остался для мест, где приблизительный ответ хуже отсутствия.
      expect(selectBankBlock(3.85, "С-П 150", 1.0)).toBeNull();
      expect(selectBankBlock(0.2, "С-П 150", 1.0)).toBeNull();
    });
  });

  describe("сочетание «с/в»", () => {
    it("просчитанное сочетание не трогает", () => {
      expect(normalizeSvCodeOrNearest("4/1")).toEqual({ standard: "4/1", nearest: null });
    });

    it("подтягивает ветер к ближайшему просчитанному при том же снеге", () => {
      // Магадан: снег III, ветер V. Снеговой район сохраняем, ветер
      // опускаем до III — это последний просчитанный при снеге III.
      expect(normalizeSvCodeOrNearest("3/5")).toEqual({
        standard: "3/2",
        nearest: { raw: "3/5", used: "3/3" },
      });
    });

    it("подтягивает и снег, когда района нет в банке вовсе", () => {
      // Банк кончается на снеговом районе V.
      expect(normalizeSvCodeOrNearest("6/2")).toEqual({
        standard: "5/3",
        nearest: { raw: "6/2", used: "5/2" },
      });
    });

    it("снег держит крепче ветра", () => {
      // 5/7: до 4/4 по ветру ближе, чем до 5/4, но снег важнее —
      // он определяет сечения, а не ветровая ветвь нагрузки.
      expect(normalizeSvCodeOrNearest("5/7").nearest?.used).toBe("5/4");
    });

    it("при равном расстоянии берёт район покрупнее", () => {
      // Ветер «Iа» стоит ровно между «1» и ничем — вниз идти некуда.
      expect(normalizeSvCodeOrNearest("2/1а").nearest?.used).toBe("2/1");
    });

    it("работает и от римских районов", () => {
      const code = svCodeFromDistrictsOrNearest("V", "VI");
      expect(code.raw).toBe("5/6");
      expect(code.nearest).toEqual({ raw: "5/6", used: "5/4" });
      expect(code.standard).toBe("5/3");
    });
  });

  describe("ветровой район на границе зон", () => {
    it("берёт самый тяжёлый из пограничных", () => {
      // Дербент и Избербаш — между IV и V, ответ расчётчика на вопрос 04.
      const derbent = resolveWindDistrict(findSettlement("Дербент, Республика Дагестан")!)!;
      expect(derbent.district).toBe("V");
      expect(derbent.w0Kpa).toBe(0.6);
      expect(derbent.border).toEqual({ between: ["IV", "V"] });
    });

    it("Багратионовск стоит между тремя районами — берём III", () => {
      const bagr = resolveWindDistrict(findSettlement("Багратионовск, Калининградская область")!)!;
      expect(bagr.district).toBe("III");
      expect(bagr.border).toEqual({ between: ["I", "II", "III"] });
    });

    it("город с проставленным районом не помечает", () => {
      const chel = resolveWindDistrict(findSettlement("Челябинск")!)!;
      expect(chel.border).toBeNull();
      expect(chel.district).toBe("II");
    });
  });
});
