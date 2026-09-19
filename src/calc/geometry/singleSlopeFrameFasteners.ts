import { isTallSingleSlope } from "../frame/singleSlopeBracing";

/**
 * Крепёж рамы для односкатного «Спринт СП» — простой случай (один
 * пролёт, два столбца), см. singleSlopeFrameGeometry.ts.
 *
 * Сверено на ШЕСТИ реальных объектах: «21851», «21777», «21510»,
 * «22295», «22271», «22236» (те же, что и в singleSlopeBracing.ts).
 * Формула ПОЛНОСТЬЮ совпадает с ведомостью на всех шести — никаких
 * ручных отклонений здесь не найдено, в отличие от «Конструкции из
 * труб».
 *
 * ГЛАВНОЕ ОТЛИЧИЕ ОТ ДВУСКАТНОГО (frameFasteners.ts):
 *   · нет фасонок ФС-1/ФС-2/ФС-3 вообще — односкатная рама их не
 *     использует (в ведомости этих строк просто нет);
 *   · «Гайка М12» = 2 × «Болт М12х40», а не 1:1, как у двускатного.
 *
 * Формулы количеств:
 *
 *   Саморез 5,5x25 = кол-во_рам × 530 (та же ставка, что и у
 *     двускатного при пролёте ≤ 12 м; на пролёте > 12 м не проверено —
 *     широкие пролёты уходят в составную раму, см. вопрос расчётчику)
 *   Дюбель-гвоздь  = 2 × (пролёт + длина) / 0,5 + 1 (та же формула, что
 *     и у двускатного)
 *   Болт М12х40    = кол-во_рам × 16 (та же ставка, что и у двускатного)
 *   Гайка М12      = 2 × Болт М12х40
 *   Шайба 12       = Болт М12х40
 *   Болт М16х50    = кол-во_рам × на_раму, где
 *     на_раму = 268 + 30×(рам−2)/рам + 12×4/рам + 12×доп/рам
 *   Гайка М16, Шайба 16 = Болт М16х50 (1:1)
 *
 * Константа 268 — ФИКСИРОВАНА на всех шести объектах (не «из банка
 * сечений», как предполагалось для двускатного — это была ошибочная
 * гипотеза по одному объекту). Коэффициент 30 и первое слагаемое 12×4 —
 * те же значения, что и у двускатного при пролёте ≤ 12 м (см.
 * frameFasteners.ts, BOLT_M16_COEF_BY_SPAN, boltM16ExtraCoef); на
 * пролёте > 12 м не проверено.
 *
 * Второе слагаемое (12×доп/рам) — доп = 4 у «высоких узких» объектов
 * (низкая высота ≥ пролёт/2: «21851», «22295», «22271») и доп = 2 у
 * остальных («21777», «21510», «22236») — ТА ЖЕ ГРАНИЦА, что определяет
 * коэффициент вертикальных связей в singleSlopeBracing.ts (не
 * совпадение — общая структурная граница для обоих узлов). При доп=2
 * формула совпадает с двускатным дословно (там второе слагаемое всегда
 * фиксировано на 12×2/рам).
 */
export interface SingleSlopeFastenerItem {
  name: string;
  count: number;
  unitMass_kg: number;
  unitPrice: number;
  mass_kg: number;
  cost: number;
}

export interface SingleSlopeFrameFastenersTakeoff {
  items: SingleSlopeFastenerItem[];
  totalMass_kg: number;
  totalCost: number;
}

/**
 * Массы и цены — из тех же реальных ведомостей, что и у двускатного
 * (см. frameFasteners.ts, FASTENER_UNITS) — совпадают дословно там, где
 * позиции общие.
 */
const FASTENER_UNITS = {
  screw525: { name: "Саморез 5,5x25", unitMass_kg: 0.0043, unitPrice: 2.2885 },
  dowel: { name: "Дюбель-гвоздь 6х60", unitMass_kg: 0.0048, unitPrice: 1.6215 },
  boltM12: { name: "Болт М12х40", unitMass_kg: 0.05, unitPrice: 11.661 },
  nutM12: { name: "Гайка М12", unitMass_kg: 0.016, unitPrice: 5.129 },
  washerM12: { name: "Шайба 12", unitMass_kg: 0.005, unitPrice: 0.9775 },
  boltM16: { name: "Болт М16х50", unitMass_kg: 0.12, unitPrice: 27.3125 },
  nutM16: { name: "Гайка М16", unitMass_kg: 0.037, unitPrice: 13.3515 },
  washerM16: { name: "Шайба 16 пруж", unitMass_kg: 0.011, unitPrice: 2.3805 },
} as const;

const SCREW_525_RATE = 530;
const BOLT_M12_RATE_PER_FRAME = 16;
const BOLT_M16_BASE = 268;
const BOLT_M16_COEF = 30;
const BOLT_M16_FIRST_EXTRA = 4;

function boltM16SecondExtra(lowHeight_m: number, span_m: number): number {
  return isTallSingleSlope(lowHeight_m, span_m) ? 4 : 2;
}

function boltM16PerFrame(lowHeight_m: number, span_m: number, frameCount: number): number {
  return (
    BOLT_M16_BASE +
    (BOLT_M16_COEF * (frameCount - 2)) / frameCount +
    (12 * BOLT_M16_FIRST_EXTRA) / frameCount +
    (12 * boltM16SecondExtra(lowHeight_m, span_m)) / frameCount
  );
}

export function computeSingleSlopeFrameFasteners(
  span_m: number,
  length_m: number,
  lowHeight_m: number,
  frameCount: number,
): SingleSlopeFrameFastenersTakeoff {
  const dowelCount = (2 * (span_m + length_m)) / 0.5 + 1;
  const boltM12Count = frameCount * BOLT_M12_RATE_PER_FRAME;
  const boltM16Count = frameCount * boltM16PerFrame(lowHeight_m, span_m, frameCount);

  const counts: [keyof typeof FASTENER_UNITS, number][] = [
    ["screw525", frameCount * SCREW_525_RATE],
    ["dowel", dowelCount],
    ["boltM12", boltM12Count],
    ["nutM12", 2 * boltM12Count],
    ["washerM12", boltM12Count],
    ["boltM16", boltM16Count],
    ["nutM16", boltM16Count],
    ["washerM16", boltM16Count],
  ];

  const items: SingleSlopeFastenerItem[] = counts.map(([key, count]) => {
    const { name, unitMass_kg, unitPrice } = FASTENER_UNITS[key];
    return { name, count, unitMass_kg, unitPrice, mass_kg: count * unitMass_kg, cost: count * unitPrice };
  });

  return {
    items,
    totalMass_kg: items.reduce((sum, i) => sum + i.mass_kg, 0),
    totalCost: items.reduce((sum, i) => sum + i.cost, 0),
  };
}
