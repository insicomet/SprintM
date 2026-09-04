import type { FrameSelection } from "../frame/types";
import { parsePgsName } from "../profiles/parseProfileName";
import { findPgsProperties } from "../profiles/pgsPriceCatalog";
import { columnLengthPerFrame_m, computeFrameCount, rafterLengthPerFrame_m } from "./frameGeometry";
import type { BuildingGeometry } from "./types";

export interface FrameMemberTakeoff {
  profileName: string;
  /** Суммарная длина по всем рамам здания, м. */
  totalLength_m: number;
  /** Масса погонного метра, кг/м — null, если профиль не нашёлся в прайсе. */
  massPerM_kg: number | null;
  /** Суммарная масса, кг — null, если масса погонного метра неизвестна. */
  totalMass_kg: number | null;
  /** Цена продажи погонного метра (+5%), ₽/м — null, если профиль не нашёлся в прайсе. */
  priceSale_perM: number | null;
  /** Суммарная стоимость, ₽ — null, если цена погонного метра неизвестна. */
  totalCost: number | null;
}

export interface FrameTakeoff {
  frameCount: number;
  column: FrameMemberTakeoff;
  beam: FrameMemberTakeoff;
  /** Суммарная масса каркаса (колонны + балки), кг — null, если хоть одна масса неизвестна. */
  totalFrameMass_kg: number | null;
  /** Суммарная стоимость каркаса (колонны + балки), ₽ — null, если хоть одна цена неизвестна. */
  totalFrameCost: number | null;
  /**
   * Масса узловых пластин на здание, кг — null, если банк сечений не даёт
   * значения для этой комбинации.
   *
   * ИСТОЧНИК: готовое число из банка сечений ИНСИ (напр. "12м"!Q6 =
   * "=30+94+70" — нераскрытая сумма без пояснения слагаемых, похоже на
   * перенос из стороннего расчёта, вероятно SCAD). Берём "как есть" на
   * ОДНУ раму и умножаем на количество рам — состав слагаемых (узел
   * конька/карниза/базы и т.д.) не восстановлен, к точной ведомости
   * КМД не готово, только для оценки массы.
   */
  gussetPlatesMass_kg: number | null;
}

function takeoffMember(profileName: string, totalLength_m: number): FrameMemberTakeoff {
  const dims = parsePgsName(profileName);
  const props = dims ? findPgsProperties(dims) : null;
  const massPerM_kg = props?.massPerM_kg ?? null;
  const priceSale_perM = props?.priceSale_perM ?? null;
  return {
    profileName,
    totalLength_m,
    massPerM_kg,
    totalMass_kg: massPerM_kg !== null ? massPerM_kg * totalLength_m : null,
    priceSale_perM,
    totalCost: priceSale_perM !== null ? priceSale_perM * totalLength_m : null,
  };
}

/**
 * Ведомость материалов каркаса (колонны + балки) по геометрии здания и
 * подобранным сечениям (см. calc/frame/sectionBank.ts).
 *
 * Не включает прогоны (считаются отдельно, calc/purlin) и связи/затяжки/
 * узловые пластины/крепёж — это следующий шаг.
 */
export function computeFrameTakeoff(geometry: BuildingGeometry, selection: FrameSelection): FrameTakeoff {
  const frameCount = computeFrameCount(geometry);

  const columnTotalLength = frameCount * columnLengthPerFrame_m(geometry);
  const beamTotalLength = frameCount * rafterLengthPerFrame_m(geometry);

  const column = takeoffMember(selection.column.profile, columnTotalLength);
  const beam = takeoffMember(selection.beam.profile, beamTotalLength);

  const totalFrameMass_kg =
    column.totalMass_kg !== null && beam.totalMass_kg !== null
      ? column.totalMass_kg + beam.totalMass_kg
      : null;
  const totalFrameCost =
    column.totalCost !== null && beam.totalCost !== null ? column.totalCost + beam.totalCost : null;

  const gussetPlatesMass_kg =
    selection.massGussetPlates_kg !== null ? selection.massGussetPlates_kg * frameCount : null;

  return { frameCount, column, beam, totalFrameMass_kg, totalFrameCost, gussetPlatesMass_kg };
}
