import { describe, expect, it } from "vitest";
import settlementsRaw from "../../data/settlementsClimate.json";
import { computeSvCode, getAllSettlementNames, qualifiedSettlementName } from "../climate/svCode";
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
 */
describe("покрытие климатического справочника", () => {
  const codes = new Map<string, string[]>();
  const failed: string[] = [];

  for (const s of settlements) {
    try {
      const { standard } = computeSvCode(qualifiedSettlementName(s));
      const bucket = codes.get(standard) ?? [];
      bucket.push(s.settlement);
      codes.set(standard, bucket);
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
    expect(failed.length).toBeLessThanOrEqual(63);
    expect(codes.size).toBeGreaterThan(0);
  });

  it("every с/в code our base can produce exists in the section bank", () => {
    const holes: string[] = [];
    for (const svCode of codes.keys()) {
      for (const span of SPANS) {
        for (const height_m of heightsFor(span)) {
          for (const responsibility of [1.0, 0.8] as ResponsibilityLevel[]) {
            // findFrameSelection не бросает, а возвращает undefined —
            // ловим именно это, иначе дыры проходят мимо теста.
            let found: unknown;
            try {
              found = findFrameSelection({ span, height_m, responsibility, svCode });
            } catch {
              found = undefined;
            }
            if (!found) holes.push(`${svCode} · ${span}м · h${height_m} · k=${responsibility}`);
          }
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`дыр в банке: ${holes.length}\n` + holes.join("\n"));
    expect(holes).toEqual([]);
  });

  it("the settlement dropdown offers every settlement exactly once", () => {
    const names = getAllSettlementNames();
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(settlements.length);
  });
});
