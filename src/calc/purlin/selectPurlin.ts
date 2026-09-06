import { getPurlinCatalog, PURLIN_SERIES } from "./catalog";
import type {
  PurlinFamily,
  PurlinSelectionInput,
  PurlinSelectionResult,
  PurlinSeriesResult,
  PurlinSteelSeries,
} from "./types";

/** γc — коэффициент надёжности по снеговой нагрузке ('Расчеты'!C5). */
const GAMMA_C = 1.4;
/** μ — переход от веса снегового покрова на земле к нагрузке на покрытие ('Расчеты'!C6). */
const MU = 1.1;
/** Коэффициент неразрезности прогона ('Расчеты'!C7). */
const CONTINUITY = 1.13;
/** Пригруз от ветра, кН/м² ('Подбор прогонов'!B8) — в исходнике константа. */
const WIND_SURCHARGE_kPa = 0.2;

/** Перебор шага прогонов в исходнике: 500…3000 мм с шагом 5 мм. */
const STEP_MIN_mm = 500;
const STEP_MAX_mm = 3000;
const STEP_INCREMENT_mm = 5;

/** Каждая линия прогона — спаренный профиль, в ведомости он идёт как 2 п.м. на метр линии. */
export const PROFILES_PER_PURLIN_LINE = 2;

/** Нагрузка на покрытие без собственного веса, кН/м² ('Подбор прогонов'!B13). */
export function roofLoadForDecking_kPa(snowLoad_kPa: number, roofSlopeDeg: number): number {
  const slopeRad = (roofSlopeDeg * Math.PI) / 180;
  return snowLoad_kPa * GAMMA_C * MU * Math.cos(slopeRad) + WIND_SURCHARGE_kPa;
}

/**
 * Семейство профилей, которое разрешает тип покрытия
 * ('Подбор прогонов'!D22/D23: под "нашу послойку" идут 2ТПС, под всё
 * остальное — 2ПС; строки "любая" и Z в итоговый выбор не попадают).
 */
export function purlinFamilyForRoofing(roofingType: string): PurlinFamily {
  return roofingType.startsWith("наше ") ? "2ТПС" : "2ПС";
}

/** Толщина утеплителя "нашей послойки" ('Подбор прогонов'!B18); 0 — фильтра нет. */
export function insulationThicknessForRoofing(roofingType: string): number {
  const match = /^наше (\d+) мм/.exec(roofingType);
  if (!match) return 0;
  const thickness = Number(match[1]);
  return thickness === 150 || thickness === 200 || thickness === 250 ? thickness : 0;
}

/**
 * Число линий прогонов на один скат при заданном шаге
 * (см. формулу массы в подборщике):
 *
 *   ВВЕРХ(пролёт / скатов / шаг; 1) + (снегозадержание ? 1,5 : 1)
 *                                   + (ограждение     ? 0,5 : 0)
 *
 * Считается по ГОРИЗОНТАЛЬНОЙ полуширине здания, а не по длине ригеля.
 * Дробные добавки — не описка исходника: половинки набираются с двух
 * скатов в целую линию (см. ведомость, где прогон под снегозадержание
 * добавляет ровно 2 п.м. на метр длины здания).
 */
export function purlinLinesPerSlope(
  span_m: number,
  step_mm: number,
  options: { snowGuardPurlin: boolean; railingPurlin?: boolean; gable?: boolean },
): number {
  const slopes = options.gable === false ? 1 : 2;
  return (
    Math.ceil(span_m / slopes / (step_mm / 1000)) +
    (options.snowGuardPurlin ? 1.5 : 1) +
    (options.railingPurlin ? 0.5 : 0)
  );
}

/** Подбор в одной серии стали. */
function selectInSeries(
  input: PurlinSelectionInput,
  series: PurlinSteelSeries,
): PurlinSeriesResult | null {
  const slopes = input.gable === false ? 1 : 2;
  const minStep = input.minStep_mm ?? 0;
  const insulation = input.insulationThickness_mm ?? 0;
  const slopeRad = (input.roofSlopeDeg * Math.PI) / 180;

  // Постоянная часть нагрузки на 1 м² кровли, кН/м² ('Расчеты'!SO4 без шага).
  const load_kPa =
    input.snowLoad_kPa * GAMMA_C * MU * Math.cos(slopeRad) +
    input.roofingSelfWeight_kg_m2 / 100 +
    WIND_SURCHARGE_kPa;

  const candidates = getPurlinCatalog(series).filter((p) => p.family === input.family);

  // Для каждого шага — самый лёгкий проходящий профиль и масса на шаг рам.
  const perStep: { step_mm: number; mass_kg: number; profile: (typeof candidates)[number] | null }[] =
    [];

  for (let step = STEP_MIN_mm; step <= STEP_MAX_mm; step += STEP_INCREMENT_mm) {
    if (step > input.maxStep_mm || step < minStep) {
      perStep.push({ step_mm: step, mass_kg: Infinity, profile: null });
      continue;
    }

    // Погонная нагрузка на прогон, кН/м.
    const q = load_kPa * CONTINUITY * (step / 1000);
    const lines = purlinLinesPerSlope(input.span_m, step, input);

    let bestMass = Infinity;
    let bestProfile: (typeof candidates)[number] | null = null;

    for (const profile of candidates) {
      // Коэффициент использования: момент однопролётной балки к предельному.
      const moment =
        ((q + profile.mass_kg_per_m / 100) * input.framePitch_m * input.framePitch_m * input.gammaN) /
        8;
      if (moment / profile.limitMoment_kNm > 1) continue;
      // 2ТПС подбираются под конкретную толщину утеплителя "нашей послойки".
      if (
        profile.insulationThickness_mm !== null &&
        insulation !== 0 &&
        profile.insulationThickness_mm !== insulation
      ) {
        continue;
      }

      const mass = lines * profile.mass_kg_per_m * input.framePitch_m * slopes;
      if (mass < bestMass) {
        bestMass = mass;
        bestProfile = profile;
      }
    }

    perStep.push({ step_mm: step, mass_kg: bestMass, profile: bestProfile });
  }

  const minMass = Math.min(...perStep.map((s) => s.mass_kg));
  if (!Number.isFinite(minMass)) return null;

  // Минимум массы достигается на целой полосе шагов. Исходник берёт первый
  // шаг полосы, если она короче трёх, и последний — если длиннее
  // ('Расчеты'!C28 с поправкой IF(B49<3;0;B49−1)).
  const first = perStep.findIndex((s) => s.mass_kg === minMass);
  let run = 0;
  while (first + run < perStep.length && perStep[first + run].mass_kg === minMass) run += 1;
  const chosen = perStep[run < 3 ? first : first + run - 1];
  if (!chosen.profile) return null;

  return {
    profile: chosen.profile,
    step_mm: chosen.step_mm,
    linesPerSlope: purlinLinesPerSlope(input.span_m, chosen.step_mm, input),
    massPerBay_kg: chosen.mass_kg,
    massPerBuilding_kg: 0, // заполняется в selectPurlin, где известна длина
  };
}

/**
 * Подбор прогонов — воспроизведение листов "Подбор прогонов 2",
 * "Расчеты 2" и "Расчеты МП390 2" подборщика ИНСИ.
 *
 * Механика исходника:
 *   1. Перебираются все шаги 500…3000 мм с шагом 5 мм, не выходящие
 *      за минимальный и максимальный допустимые.
 *   2. Для каждого шага и каждого профиля разрешённого семейства
 *      считается коэффициент использования; профили с к.и. > 1 отсеиваются.
 *   3. Масса прогонов на один шаг рам = линий_на_скат × масса_1м ×
 *      шаг_рам × скатов; берётся самый лёгкий профиль.
 *   4. Выбирается шаг с минимальной массой (правило разрешения ничьих —
 *      см. selectInSeries).
 *   5. То же считается для двух серий стали, побеждает более лёгкая;
 *      при равенстве остаётся МП350 (исходник сравнивает строго: >).
 *
 * Проверено на обоих реальных проектах:
 *   "22316" (Березовский, 18×30, шаг рам 4,5, снег 1,5 кПа,
 *            прогон под снегозадержание есть, макс. шаг 2150):
 *            МП350, 2ПС 200х65х1,5, шаг 1800, 476,19 кг на шаг,
 *            3174,6 кг на здание;
 *   "22318" (Сургут, 15×24, шаг рам 4, снег 1,8 кПа, без
 *            снегозадержания, макс. шаг 1900):
 *            МП390, 2ПС 195х45х1,5, шаг 1900, 325,6/283,2 кг на шаг,
 *            1699,2 кг на здание.
 */
export function selectPurlin(
  input: PurlinSelectionInput,
  buildingLength_m: number,
): PurlinSelectionResult | null {
  const withBuildingMass = (r: PurlinSeriesResult | null): PurlinSeriesResult | null =>
    r === null
      ? null
      : { ...r, massPerBuilding_kg: (r.massPerBay_kg * buildingLength_m) / input.framePitch_m };

  const results = PURLIN_SERIES.map((series) => withBuildingMass(selectInSeries(input, series)));
  const [r350, r390] = results;

  // 'Подбор прогонов'!P26 = IF(M23>M30; вариант МП390; вариант МП350).
  let winner: PurlinSeriesResult | null;
  let runnerUp: PurlinSeriesResult | null;
  if (r350 === null) {
    winner = r390;
    runnerUp = null;
  } else if (r390 === null) {
    winner = r350;
    runnerUp = null;
  } else if (r350.massPerBay_kg > r390.massPerBay_kg) {
    winner = r390;
    runnerUp = r350;
  } else {
    winner = r350;
    runnerUp = r390;
  }
  if (!winner) return null;

  return {
    ...winner,
    runnerUp,
    // 'Подбор прогонов'!L = масса на здание / ширину / длину × 1,05.
    massPerBuildingArea_kg_m2:
      (winner.massPerBuilding_kg / input.span_m / buildingLength_m) * 1.05,
  };
}
