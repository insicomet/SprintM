import type { Span } from "../../types/common";

export interface DowelFastenersResult {
  count: number;
  mass_kg: number;
  /** true, если для этого пролёта нет подтверждённого примера (использована ближайшая известная плотность). */
  isEstimated: boolean;
}

/** Масса одного дюбеля-гвоздя 6х60, кг — литеральное значение из файла "22318" (H76/H86), одинаково во всех 5 листах. */
const DOWEL_UNIT_MASS_KG = 0.0048;

/**
 * Кол-во "Дюбель гвоздь 6х60" на здание — крепёж нижней обвязки по
 * периметру здания. По 4 из 5 листов файла "22318" (12м/15/18/1ск):
 *
 *   count = периметр / 0,5 + 1        (периметр = 2×(пролёт + длина))
 *
 * Лист "21" — единственное исключение: формула вида "периметр/0,5*2"
 * (плотность вдвое выше, без "+1"). Это может быть свойство пролёта
 * 21м (более высокая ветровая/снеговая нагрузка) либо разовое решение
 * конкретного проекта — подтверждено только одним примером, поэтому для
 * пролёта 21м используется удвоенная плотность, а для 24м (нет примера
 * вовсе) она же — как более консервативное предположение, с флагом
 * isEstimated.
 */
export function computeDowelFasteners(span: Span, buildingPerimeter_m: number): DowelFastenersResult {
  const isDoubleDensity = span === 21 || span === 24;
  const isEstimated = span === 24;
  const count = isDoubleDensity
    ? (buildingPerimeter_m / 0.5) * 2
    : buildingPerimeter_m / 0.5 + 1;
  return { count, mass_kg: count * DOWEL_UNIT_MASS_KG, isEstimated };
}
