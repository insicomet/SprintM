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
}

export interface FrameTakeoff {
  frameCount: number;
  column: FrameMemberTakeoff;
  beam: FrameMemberTakeoff;
  /** Суммарная масса каркаса (колонны + балки), кг — null, если хоть одна масса неизвестна. */
  totalFrameMass_kg: number | null;
}

function takeoffMember(profileName: string, totalLength_m: number): FrameMemberTakeoff {
  const dims = parsePgsName(profileName);
  const props = dims ? findPgsProperties(dims) : null;
  const massPerM_kg = props?.massPerM_kg ?? null;
  return {
    profileName,
    totalLength_m,
    massPerM_kg,
    totalMass_kg: massPerM_kg !== null ? massPerM_kg * totalLength_m : null,
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

  return { frameCount, column, beam, totalFrameMass_kg };
}
