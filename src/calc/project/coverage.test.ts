import { describe, expect, it } from "vitest";
import settlementsRaw from "../../data/settlementsClimate.json";
import {
  computeSvCode,
  getAllSettlementNames,
  qualifiedSettlementName,
  svCodeFromDistricts,
} from "../climate/svCode";
import { selectBankBlock } from "../climate/snowLadder";
import { findFrameSelection } from "../frame/sectionBank";
import type { SettlementClimate } from "../climate/types";
import { SPANS, type ResponsibilityLevel, type Span } from "../../types/common";

const settlements = settlementsRaw as unknown as SettlementClimate[];

/** Высоты, попадающие в каждую из корзин банка (см. HEIGHT_BUCKETS_*). */
const HEIGHTS_9_21 = [3, 4.5, 6];
const HEIGHTS_24 = [6, 7, 8, 9];

function heightsFor(span: Span): number[] {
  return span === 24 ? HEIGHTS_24 : HEIGHTS_9_21;
}

/**
 * Покрытие справочника: до какой доли реальных городов расчёт вообще
 * доходит. Это не сверка с расчётчиком, а проверка полноты данных —
 * дыра здесь означает, что пользователю выпадет ошибка на живом городе.
 *
 * Идём тем же путём, что и приложение: снеговой район и k берём из
 * лестницы нагрузок ИНСИ, ветровой — из справочника по СП.
 */
describe("покрытие климатического справочника", () => {
  const combos = new Set<string>();
  const failed: string[] = [];

  for (const s of settlements) {
    try {
      const base = computeSvCode(qualifiedSettlementName(s));
      const snow = base.city.snow.sgKpa;
      const wind = base.city.wind.region;
      if (snow === null || !wind) throw new Error("нет снеговой нагрузки или ветрового района");

      for (const gammaN of [1.0, 0.8] as ResponsibilityLevel[]) {
        const block = selectBankBlock(snow, "С-П 150", gammaN);
        if (!block) throw new Error(`лестница не покрывает ${snow} кПа при γn=${gammaN}`);
        const { standard } = svCodeFromDistricts(block.snowDistrict, wind);
        combos.add(`${standard}|${block.bankK}`);
      }
    } catch (e) {
      failed.push(`${s.settlement}: ${(e as Error).message}`);
    }
  }

  it("says how many settlements the ИНСИ bank simply does not cover", () => {
    // Не все города страны попадают в банк: Камчатка, Сахалин, Норильск,
    // Черноморское побережье дают сочетания снег/ветер, которых у ИНСИ
    // просто нет. Фиксируем факт, чтобы список не рос молча.
    // eslint-disable-next-line no-console
    console.log(`покрыто ${settlements.length - failed.length} из ${settlements.length}`);
    expect(failed.length).toBeLessThanOrEqual(70);
    expect(combos.size).toBeGreaterThan(0);
  });

  it("every combination the ladder can produce exists in the section bank", () => {
    const holes: string[] = [];
    for (const combo of combos) {
      const [svCode, k] = combo.split("|");
      const responsibility = Number(k) as ResponsibilityLevel;
      for (const span of SPANS) {
        for (const height_m of heightsFor(span)) {
          // findFrameSelection не бросает, а возвращает undefined —
          // ловим именно это, иначе дыры проходят мимо теста.
          let found: unknown;
          try {
            found = findFrameSelection({ span, height_m, responsibility, svCode });
          } catch {
            found = undefined;
          }
          if (!found) holes.push(`${svCode} · k=${k} · ${span}м · h${height_m}`);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`комбинаций: ${combos.size}, дыр в банке: ${holes.length}\n` + holes.join("\n"));
    expect(holes).toEqual([]);
  });

  it("the settlement dropdown offers every settlement exactly once", () => {
    const names = getAllSettlementNames();
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(settlements.length);
  });
});
