import { findPurlinPrice } from "./purlinPriceCatalog";
import { purlinLinesPerSlope } from "./selectPurlin";
import type { PurlinSelectionResult } from "./types";

export interface PurlinLayout {
  /**
   * Число линий прогонов по всей кровле БЕЗ добавок под снегозадержание
   * и ограждение — то, чем в ведомости считается крепёж кровельных панелей.
   */
  lineCount: number;
  /** Суммарная длина линий прогонов на здание, м. */
  totalLineLength_m: number;
  /**
   * Суммарная длина ПРОФИЛЯ на здание, п.м. — то, что стоит в ведомости:
   * линия "2ПС" собрана из двух профилей "ПС", поэтому метров вдвое больше.
   */
  totalProfileLength_m: number;
  /** Суммарная масса прогонов на здание, кг. */
  totalMass_kg: number;
  /** Суммарная стоимость прогонов, ₽ — null, если профиль не нашёлся в прайс-листе. */
  totalCost: number | null;
}

/** Сколько одиночных профилей в одной линии прогона: 2ПС/2ТПС — спаренные, Z — одиночный. */
function profilesPerLine(family: PurlinSelectionResult["profile"]["family"]): number {
  return family === "Z" ? 1 : 2;
}

/**
 * Раскладка прогонов по кровле.
 *
 * В ведомости прогоны идут одной строкой в погонных метрах, и её формула
 * в обоих реальных проектах записана так (лист "12м", строка 24):
 *
 *   "22316": =6*2*2*C9 + 2*C9        → 780 п.м. при длине 30
 *   "22318": =5*2*2*C9 + 2*C9*0      → 480 п.м. при длине 24
 *
 * то есть  (линий_на_скат × скатов × 2_профиля) × длина, где добавка
 * "+2*C9" — это половинка линии на каждый скат под снегозадержание,
 * набирающаяся в целые 2 п.м. на метр длины здания. Ровно та же величина
 * стоит в формуле массы подборщика, поэтому берём её оттуда
 * (purlinLinesPerSlope) — и масса на здание сходится с подборщиком
 * до килограмма: 3174,6 кг в "22316" и 1699,2 кг в "22318".
 *
 * Крепёж кровельных панелей при этом считается по ЦЕЛОМУ числу линий, без
 * добавок: расчётчик вбивал туда 12 и 10 — это ВВЕРХ(полупролёт/шаг)+1 на
 * скат, умноженное на число скатов.
 */
export function computePurlinLayout(
  purlin: PurlinSelectionResult,
  span_m: number,
  buildingLength_m: number,
  options: { snowGuardPurlin: boolean; railingPurlin?: boolean; gable?: boolean },
): PurlinLayout {
  const slopes = options.gable === false ? 1 : 2;
  const step_m = purlin.step_mm / 1000;

  const lineCount = (Math.ceil(span_m / slopes / step_m) + 1) * slopes;

  const linesPerSlope = purlinLinesPerSlope(span_m, purlin.step_mm, options);
  const totalLineLength_m = linesPerSlope * slopes * buildingLength_m;
  const totalProfileLength_m = totalLineLength_m * profilesPerLine(purlin.profile.family);
  const totalMass_kg = totalLineLength_m * purlin.profile.mass_kg_per_m;

  // Прайс отдаёт цену за метр ГОТОВОГО прогона (для 2ПС/2ТПС уже удвоенную),
  // поэтому умножаем на длину линий, а не профиля. Берём БАЗОВУЮ цену —
  // именно её расчётчик ставит в строку прогонов (575 ₽/п.м в "22316",
  // 508 ₽/п.м в "22318"), а не цену продажи с +5%.
  const price = findPurlinPrice(purlin.profile.name);
  const totalCost = price?.priceBase_perM != null ? price.priceBase_perM * totalLineLength_m : null;

  return { lineCount, totalLineLength_m, totalProfileLength_m, totalMass_kg, totalCost };
}
