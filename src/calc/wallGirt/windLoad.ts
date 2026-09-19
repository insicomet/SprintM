/**
 * Ветровая нагрузка на обвязку стен под профлист — воспроизведение листа
 * «Ветер по СП» «Калькулятор ограждайки v1.5.xlsx» (формулы получены от
 * расчётчика построчно, сверены на примере файла «Благовещенск»,
 * 24×24×10,5, тип местности «В», wo=0,3 кПа: C11=k(ze)=0,66,
 * C12=ζ(ze)=1,053, F7 (угловая, w=1,25200152 кПа) и G7 (рядовая,
 * w=0,79672824 кПа) совпали день в день).
 *
 * Норма СП РК EN («Ветер по EN») здесь не реализована — казахстанские
 * объекты по новым нормам редки и переключаются вручную (см. вопрос
 * расчётчику про «21810»).
 */

export type TerrainType = "А" | "В" | "С";

/** γf — коэффициент надёжности по ветровой нагрузке ('Ветер по СП'!C13). */
const GAMMA_F = 1.4;

/** Аэродинамический коэффициент c для зоны обвязки ('Ветер по СП'!F6/G6). */
const AERO_COEFF: Record<"corner" | "typical", number> = {
  corner: 2.2,
  typical: 1.4,
};

/**
 * k(ze) — коэффициент изменения давления по высоте, уже "сглаженный"
 * (столбцы N:P листа, использованы формулой напрямую, без пересчёта) —
 * высоты (м) и значения для типов местности А/В/С ('Ветер по СП'!J52:P63).
 */
const K_ZE_TABLE: { height_m: number; А: number; В: number; С: number }[] = [
  { height_m: 5, А: 1.025, В: 0.665, С: 0.4 },
  { height_m: 10, А: 1.0125, В: 0.66, С: 0.4075 },
  { height_m: 20, А: 1.13125, В: 0.73125, С: 0.43125 },
  { height_m: 40, А: 1.205, В: 0.805, С: 0.505 },
  { height_m: 60, А: 1.32875, В: 0.92875, С: 0.62875 },
  { height_m: 80, А: 1.32875, В: 0.92875, С: 0.80250 },
  { height_m: 100, А: 1.5525, В: 1.063, С: 0.713 },
  { height_m: 150, А: 1.692, В: 1.342, С: 0.8525 },
  { height_m: 200, А: 1.692, В: 1.342, С: 1.042 },
  { height_m: 250, А: 2.171, В: 1.342, С: 1.042 },
  { height_m: 300, А: 2.75, В: 1.0525, С: 1.3315 },
  { height_m: 350, А: 2.75, В: 2.75, С: 1.30538461538462 },
];

/**
 * ζ(ze) — коэффициент пульсации давления, тот же принцип, что у k(ze)
 * ('Ветер по СП'!R52:R63, столбцы W/Z/AB для А/В/С соответственно).
 */
const ZETA_ZE_TABLE: { height_m: number; А: number; В: number; С: number }[] = [
  { height_m: 5, А: 0.751, В: 1.044, С: 1.78 },
  { height_m: 10, А: 0.7565, В: 1.053, С: 1.766 },
  { height_m: 20, А: 0.72325, В: 0.977, С: 1.614 },
  { height_m: 40, А: 0.679, В: 0.8885, С: 1.437 },
  { height_m: 60, А: 0.6295, В: 0.839, С: 1.338 },
  { height_m: 80, А: 0.6295, В: 0.80425, С: 1.2685 },
  { height_m: 100, А: 0.5937, В: 0.7595, С: 1.179 },
  { height_m: 150, А: 0.5658, В: 0.7316, С: 1.0674 },
  { height_m: 200, А: 0.5658, В: 0.6558, С: 0.9916 },
  { height_m: 250, А: 0.5179, В: 0.6558, С: 0.9916 },
  { height_m: 300, А: 0.46, В: 0.6558, С: 0.9337 },
  { height_m: 350, А: 0.46, В: 0.57223076923077, С: 0.86057692307692 },
];

/**
 * Таблица снижения пикового давления по площади загружения
 * ('Ветер по СП'!V5:AD6) — точки интерполяции уже посчитаны в файле,
 * здесь взяты как готовые значения (ступенчатый поиск "не больше", как
 * в исходнике: MATCH(...,1) без дополнительной интерполяции в коде).
 */
const AREA_REDUCTION_TABLE: { area_m2: number; coeff: number }[] = [
  { area_m2: 0, coeff: 1 },
  { area_m2: 2, coeff: 1 },
  { area_m2: 3, coeff: 0.95 },
  { area_m2: 4, coeff: 0.9 },
  { area_m2: 5, coeff: 0.85 },
  { area_m2: 7.5, coeff: 0.8 },
  { area_m2: 10, coeff: 0.75 },
  { area_m2: 15, coeff: 0.7 },
  { area_m2: 20, coeff: 0.65 },
];

/** MATCH(x, breakpoints, 1) — последняя точка, не превышающая x; ниже первой — берём первую. */
function stepLookup<T extends { [key: string]: number }>(
  table: readonly T[],
  key: keyof T,
  x: number,
): T {
  let chosen = table[0];
  for (const row of table) {
    if (row[key] <= x) chosen = row;
    else break;
  }
  return chosen;
}

/** k(ze) для заданной высоты и типа местности. */
export function kZe(height_m: number, terrain: TerrainType): number {
  return stepLookup(K_ZE_TABLE, "height_m", height_m)[terrain];
}

/** ζ(ze) для заданной высоты и типа местности. */
export function zetaZe(height_m: number, terrain: TerrainType): number {
  return stepLookup(ZETA_ZE_TABLE, "height_m", height_m)[terrain];
}

/** Коэффициент снижения пикового давления по площади загружения, м². */
export function areaReductionCoeff(area_m2: number): number {
  return stepLookup(AREA_REDUCTION_TABLE, "area_m2", area_m2).coeff;
}

/**
 * Расчётное ветровое давление на зону (угловую/рядовую) без учёта площади
 * загружения, кПа ('Ветер по СП'!F7/G7):
 *
 *   w = wo × k(ze) × (1 + ζ(ze)) × c_зоны × γf
 */
export function zoneWindPressure_kPa(
  w0_kPa: number,
  height_m: number,
  terrain: TerrainType,
  zone: "corner" | "typical",
): number {
  const h = Math.max(5, height_m);
  return w0_kPa * kZe(h, terrain) * (1 + zetaZe(h, terrain)) * AERO_COEFF[zone] * GAMMA_F;
}

/**
 * Расчётное давление на зону с учётом снижения по площади загружения
 * (площадь = шаг ригелей × шаг стоек) и коэффициента ответственности γn,
 * кПа ('Расчет Угловая'!AD5, через C3 = 'Ветер по СП'!F7 × Лист1!B3).
 *
 * Лист1!B3 — константа (не формула по СП), но численно совпадает с полем
 * «Ур. отв.» того же объекта («Благовещенск» — 0,8 в обоих местах): это
 * тот же коэффициент ответственности γn/bankK, что уже используется в
 * подборе сечения рамы (bankK), только применённый здесь напрямую к
 * ветровому давлению, а не к банку сечений.
 */
export function girtWindPressure_kPa(
  w0_kPa: number,
  height_m: number,
  terrain: TerrainType,
  zone: "corner" | "typical",
  stepRigel_m: number,
  postStep_m: number,
  gammaN: number,
): number {
  const zonePressure = zoneWindPressure_kPa(w0_kPa, height_m, terrain, zone) * gammaN;
  const area_m2 = stepRigel_m * postStep_m;
  return zonePressure * areaReductionCoeff(area_m2);
}
