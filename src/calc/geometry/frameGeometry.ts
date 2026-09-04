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
 * Суммарная длина ригеля (балки) одной рамы, м — обе скатные линии от конька до карниза.
 * (span/2)/cos(уклон) на каждый скат, т.е. span/cos(уклон) на раму в целом.
 */
export function rafterLengthPerFrame_m(geometry: Pick<BuildingGeometry, "span_m" | "roofSlopeDeg">): number {
  const slopeRad = (geometry.roofSlopeDeg * Math.PI) / 180;
  return geometry.span_m / Math.cos(slopeRad);
}

/**
 * Суммарная длина колонн одной рамы, м — две колонны от пола до карниза.
 *
 * ОТКРЫТОЕ ДОПУЩЕНИЕ: в исходной ведомости материалов (файл "22316")
 * аналогичная строка считалась как I17*4*(высота-0.07) — то есть на 4,
 * а не на 2 колонны на раму. Не удалось однозначно подтвердить, что
 * означает этот множитель 4 в контексте конкретного проекта (доп.
 * фахверковые стойки? двухпролётное здание?), поэтому здесь принята
 * более консервативная и обычная схема "2 колонны на раму" — это
 * нужно свериться на реальном примере, прежде чем полагаться на
 * абсолютные цифры веса каркаса.
 */
export function columnLengthPerFrame_m(geometry: Pick<BuildingGeometry, "height_m">): number {
  return 2 * (geometry.height_m - EAVE_OFFSET_M);
}
