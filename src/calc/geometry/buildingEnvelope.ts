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
 * Площадь стен, м² — два продольных фасада (до карниза) + два торцевых
 * фронтона (прямоугольник + треугольник фронтона). Ворота/двери/окна
 * не вычитаются — это отдельная позиция ведомости.
 */
export function computeWallArea_m2(geometry: BuildingGeometry): number {
  const sideWalls = 2 * geometry.length_m * geometry.height_m;

  const slopeRad = (geometry.roofSlopeDeg * Math.PI) / 180;
  const gableRise_m = (geometry.span_m / 2) * Math.tan(slopeRad);
  const endWallRectangle = geometry.span_m * geometry.height_m;
  const endWallTriangle = 0.5 * geometry.span_m * gableRise_m;
  const endWalls = 2 * (endWallRectangle + endWallTriangle);

  return sideWalls + endWalls;
}
