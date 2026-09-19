import { getPricedGirtBearingRows, isPairedSection, resolvePricedProfile } from "./bearingCatalog";
import { computeGirtZone } from "./wallGirt";
import { girtWindPressure_kPa, type TerrainType } from "./windLoad";
import type { GirtProfileOption, GirtZoneKind, GirtZoneResult } from "./types";

/** Шаг перебора ригелей в исходнике: 500…3000 мм с шагом 10 мм ('Расчет Угловая'!AD2:BGN2). */
const STEP_MIN_mm = 500;
const STEP_MAX_mm = 3000;
const STEP_INCREMENT_mm = 10;

export interface GirtAutoSelectionInput {
  zoneKind: GirtZoneKind;
  /** Протяжённость зоны, м. */
  zoneLength_m: number;
  /** Высота расчётной стены, м (Лист1!B12) — идёт в число рядов/массу. */
  wallHeight_m: number;
  /** Общая высота здания, м (Лист1!B8) — идёт в k(ze)/ζ(ze), не менее 5 м по норме. */
  buildingHeight_m: number;
  /** Шаг стоек, м (Лист1!B13). */
  postStep_m: number;
  /** wo — нормативное ветровое давление по городу, кПа. */
  w0_kPa: number;
  terrain: TerrainType;
  /** Толщина утеплителя «нашей послойки», мм; 0 — фильтр по толщине не применяется. */
  insulationThickness_mm?: number;
  /**
   * Коэффициент использования вручную (Лист1!B32) вместо значения профиля
   * по умолчанию («макс к-т исп по умолчанию» в несушке). 0/не задано —
   * берём значение профиля.
   */
  utilizationOverride?: number;
  minStep_mm?: number;
  maxStep_mm?: number;
  /** Границы высоты профиля, мм (Лист1!B33/B34) — не заданы, если не нужны. */
  minProfileHeight_mm?: number;
  maxProfileHeight_mm?: number;
}

export interface GirtAutoSelectionResult {
  profile: GirtProfileOption;
  paired: boolean;
  stepRigel_mm: number;
  /** Действующий момент при выбранном шаге, кН·м. */
  moment_kNm: number;
  /** Коэффициент использования по моменту (≤1 — прошёл проверку). */
  utilization: number;
  zone: GirtZoneResult;
}

/** Действующий момент М=q·L²/8 на один ригель при заданном шаге, кН·м. */
function moment_kNm(pressure_kPa: number, stepRigel_m: number, postStep_m: number): number {
  const q_kN_per_m = pressure_kPa * stepRigel_m;
  return (q_kN_per_m * postStep_m * postStep_m) / 8;
}

/**
 * Автоподбор профиля и шага ригелей обвязки стены под профлист —
 * воспроизведение цепочки «Расчет Угловая»/«Расчет Рядовая» «Калькулятор
 * ограждайки v1.5.xlsx»: момент q·L²/8 (ветровое давление с учётом
 * снижения по площади загружения — см. windLoad.ts) → коэффициент
 * использования по несущей способности профиля (несушки) ≤1 → среди
 * прошедших проверку на каждом шаге берётся самый лёгкий профиль (масса
 * профиля + кронштейнов, по уже проверенным формулам wallGirt.ts) → среди
 * всех шагов — тот, что даёт минимальную массу.
 *
 * Сверено на живом примере файла («Благовещенск», 24×24×10,5, тип
 * местности «В», профлист без утепления): для обеих зон момент/давление
 * совпали день в день (см. windLoad.ts); выбор профиля этим алгоритмом —
 * "]ПП 145x45x1,5" (угловая) / "]ПП 145x45x1,2" (рядовая) — тоже сошёлся
 * с ведомостью один в один (см. selectGirt.test.ts).
 *
 * Не воспроизведено (уточняется по мере надобности):
 *  — поправка «×P4» для профилей толщиной ровно 1 мм (в 'Расчет
 *    Угловая'!X7) — на проверенном примере не используется (там 1,2/1,5 мм);
 *  — дополнительные слагаемые массы «верхнего/нижнего ригеля» (TN/TO в
 *    исходнике) — не встречались в проверенном примере;
 *  — фильтр по «раскреп»/высоте профиля/типу обшивки (Лист1!B33:B36 и
 *    соседние) — минимальные и максимальные границы шага уже фильтруются,
 *    остальное пока не ограничиваем.
 */
export function selectGirtProfile(input: GirtAutoSelectionInput): GirtAutoSelectionResult | null {
  const insulation = input.insulationThickness_mm ?? 0;
  const minStep = input.minStep_mm ?? STEP_MIN_mm;
  const maxStep = input.maxStep_mm ?? STEP_MAX_mm;
  const zone: "corner" | "typical" = input.zoneKind === "corner" ? "corner" : "typical";

  const minHeight = input.minProfileHeight_mm ?? -Infinity;
  const maxHeight = input.maxProfileHeight_mm ?? Infinity;
  const candidates = getPricedGirtBearingRows().filter(
    (row) =>
      row.толщина_утепления_мм === insulation &&
      row.высота_профиля_мм >= minHeight &&
      row.высота_профиля_мм <= maxHeight,
  );

  let best: GirtAutoSelectionResult | null = null;
  let bestTotalMass = Infinity;

  for (let step = STEP_MIN_mm; step <= STEP_MAX_mm; step += STEP_INCREMENT_mm) {
    if (step < minStep || step > maxStep) continue;
    const step_m = step / 1000;

    const pressure = girtWindPressure_kPa(
      input.w0_kPa,
      input.buildingHeight_m,
      input.terrain,
      zone,
      step_m,
      input.postStep_m,
    );
    const moment = moment_kNm(pressure, step_m, input.postStep_m);

    for (const row of candidates) {
      const limitMoment = row.пред_момент * (input.utilizationOverride || row.к_т_исп_по_умолчанию);
      const utilization = moment / limitMoment;
      if (utilization > 1) continue;

      const priced = resolvePricedProfile(row);
      if (!priced) continue;
      const paired = isPairedSection(row);

      const zoneResult = computeGirtZone({
        zoneKind: input.zoneKind,
        zoneLength_m: input.zoneLength_m,
        wallHeight_m: input.wallHeight_m,
        postStep_m: input.postStep_m,
        stepRigel_mm: step,
        profile: priced,
        paired,
      });
      const totalMass = zoneResult.profileMass_kg + zoneResult.bracketWeight_kg;

      if (totalMass < bestTotalMass) {
        bestTotalMass = totalMass;
        best = { profile: priced, paired, stepRigel_mm: step, moment_kNm: moment, utilization, zone: zoneResult };
      }
    }
  }

  return best;
}
