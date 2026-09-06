import type { BuildingGeometry } from "./types";

/**
 * Число рам в здании ('6dc1157d...'!I17: =CEILING(длина/шаг+1,1)).
 * Рамы стоят по краям и с заданным шагом внутри.
 */
export function computeFrameCount(geometry: Pick<BuildingGeometry, "length_m" | "framePitch_m">): number {
  return Math.ceil(geometry.length_m / geometry.framePitch_m + 1);
}

/** Смещение колонны от уровня пола до низа ригеля (карнизный узел), м — константа из исходного файла. */
export const EAVE_OFFSET_M = 0.07;

/**
 * Значение π, которым исходные ведомости переводят уклон в радианы:
 * "=15*3.14/180" (лист "12м", ячейка J14). Это округление автора файла,
 * а не настоящее π.
 *
 * ВРЕМЕННОЕ РЕШЕНИЕ: воспроизводим как в источнике, чтобы длины
 * совпадали с расчётом расчётчика до знака; после сверки заменить на
 * Math.PI. Расхождение мизерное — 0,004% (на ригеле 217 м это 8 мм).
 */
const SOURCE_PI = 3.14;

/**
 * Суммарная длина ригеля (балки) одной рамы, м — обе скатные линии от конька до карниза.
 * (span/2)/cos(уклон) на каждый скат, т.е. span/cos(уклон) на раму в целом.
 */
export function rafterLengthPerFrame_m(geometry: Pick<BuildingGeometry, "span_m" | "roofSlopeDeg">): number {
  const slopeRad = (geometry.roofSlopeDeg * SOURCE_PI) / 180;
  return geometry.span_m / Math.cos(slopeRad);
}

/** Суммарная длина колонн одной рамы, м — две колонны от пола до карниза. */
export function columnLengthPerFrame_m(geometry: Pick<BuildingGeometry, "height_m">): number {
  return 2 * (geometry.height_m - EAVE_OFFSET_M);
}

/**
 * Сколько профилей идёт на одно сечение колонны и ригеля.
 *
 * Сечение собирается из ДВУХ профилей ПГС-сигма. В обеих реальных
 * ведомостях это прямо в формулах (лист "12м", строки 21 и 22):
 *
 *   балка   = кол-во_рам × длина_ригеля × 2
 *   колонна = кол-во_рам × 4 × (высота − 0,07)   // 2 колонны × 2 профиля
 *
 * Сходится численно на обоих проектах: "22316" (8 рам, пролёт 18,
 * высота 5) даёт балку 298,15 п.м. и колонну 157,76 п.м.; "22318"
 * (7 рам, пролёт 15) — 217,40 и 138,04 п.м.
 */
export const PROFILES_PER_MEMBER = 2;
