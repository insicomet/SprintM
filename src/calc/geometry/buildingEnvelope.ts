import { rafterLengthPerFrame_m } from "./frameGeometry";
import type { BuildingGeometry } from "./types";

/**
 * Площадь кровли (оба ската), м² — длина ската на всю ширину здания
 * (span/cos(уклон)) умноженная на длину здания. Проёмы (фонари,
 * вентиляция) не вычитаются.
 */
export function computeRoofArea_m2(geometry: BuildingGeometry): number {
  return rafterLengthPerFrame_m(geometry) * geometry.length_m;
}

/**
 * Площадь стен, м² — по формуле обеих реальных ведомостей (строка
 * "СП 100"):
 *
 *   (пролёт + длина) × 2 × высота  +  пролёт × 2 × 2
 *
 * Первое слагаемое — периметр на высоту (оба продольных фасада плюс
 * прямоугольная часть обоих торцов). Второе — надбавка на фронтоны:
 * ИНСИ считает её как 2×пролёт на фронтон, не по геометрии треугольника.
 * Для пролёта 18м и уклона 15° это 36 м² против геометрических 21,7 м²,
 * то есть с запасом — видимо, на подрезку панелей по скату.
 *
 * Ворота/двери/окна не вычитаются: в исходнике они вычитаются прямо в
 * формуле вручную, у нас это отдельный ввод проёмов.
 */
export function computeWallArea_m2(geometry: BuildingGeometry): number {
  const perimeterWalls = (geometry.span_m + geometry.length_m) * 2 * geometry.height_m;
  const gableAllowance = geometry.span_m * 2 * 2;
  return perimeterWalls + gableAllowance;
}
