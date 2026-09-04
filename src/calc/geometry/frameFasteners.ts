import type { BuildingGeometry } from "./types";

export interface FrameFastenersTakeoff {
  /** Кол-во "Фс11, Фс14" на здание, шт. */
  fc11_14Count: number;
  /** Кол-во "Фс12" на здание, шт (= 2 × fc11_14Count). */
  fc12Count: number;
  fc11_14Mass_kg: number;
  fc12Mass_kg: number;
  totalMass_kg: number;
}

/** Масса одной единицы, кг — литеральные значения из файла "22316" ("12м"!H29/H30), не из внешнего прайса. */
const FC11_14_UNIT_MASS_KG = 1.4;
const FC12_UNIT_MASS_KG = 0.5;

/**
 * Крепёж каркаса "Фс11/Фс14" и "Фс12" — количество по формуле,
 * подтверждённой на реальном примере из файла "22316" ("12м"!C29/C30):
 *
 *   Фс11,Фс14 = кол-во_рам × (пролёт + 2×высота) / 0,6
 *   Фс12      = 2 × Фс11,Фс14
 *
 * Проверено: пролёт=18, высота=5, рам=8 -> 8×(18+10)/0,6 = 373,33 —
 * совпадает со значением в исходной ведомости (373 шт, Фс12=747 шт).
 *
 * ОТКРЫТЫЙ ВОПРОС: точное физическое назначение "Фс11/Фс14/Фс12" не
 * подтверждено (буквальное название в файле — просто код позиции;
 * судя по массе ~1,4 и ~0,5 кг за штуку, это, вероятно, не саморезы,
 * а какой-то крепёжный элемент/кронштейн покрупнее). Цена неизвестна
 * — в исходном файле ссылается на отсутствующий у нас внешний прайс
 * "[1]Основные".
 */
export function computeFrameFasteners(
  geometry: Pick<BuildingGeometry, "span_m" | "height_m">,
  frameCount: number,
): FrameFastenersTakeoff {
  const fc11_14Count = (frameCount * (geometry.span_m + 2 * geometry.height_m)) / 0.6;
  const fc12Count = 2 * fc11_14Count;

  const fc11_14Mass_kg = fc11_14Count * FC11_14_UNIT_MASS_KG;
  const fc12Mass_kg = fc12Count * FC12_UNIT_MASS_KG;

  return {
    fc11_14Count,
    fc12Count,
    fc11_14Mass_kg,
    fc12Mass_kg,
    totalMass_kg: fc11_14Mass_kg + fc12Mass_kg,
  };
}
