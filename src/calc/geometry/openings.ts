export interface OpeningsInput {
  gatesCount: number;
  gateWidth_m: number;
  gateHeight_m: number;
  doorsCount: number;
  doorWidth_m: number;
  doorHeight_m: number;
  /** Суммарная площадь окон, м² (упрощённо — без раскладки на отдельные проёмы). */
  windowsArea_m2: number;
}

export const DEFAULT_OPENINGS: OpeningsInput = {
  gatesCount: 1,
  gateWidth_m: 4,
  gateHeight_m: 4.5,
  doorsCount: 1,
  doorWidth_m: 1,
  doorHeight_m: 2.1,
  windowsArea_m2: 0,
};

/** Суммарная площадь проёмов (ворота + двери + окна), м² — вычитается из площади стен под обшивку. */
export function computeOpeningsArea_m2(openings: OpeningsInput): number {
  const gatesArea = openings.gatesCount * openings.gateWidth_m * openings.gateHeight_m;
  const doorsArea = openings.doorsCount * openings.doorWidth_m * openings.doorHeight_m;
  return gatesArea + doorsArea + openings.windowsArea_m2;
}
