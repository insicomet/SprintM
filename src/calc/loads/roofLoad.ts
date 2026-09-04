/**
 * Расчёт нормативной/расчётной нагрузки на кровлю для подбора прогонов.
 *
 * Собрано по формулам, найденным в листах "Подбор прогонов" и "Расчеты"
 * исходного файла ИНСИ:
 *   - Расчеты!C8: "расчетная снеговая нагрузка" — берётся из справочника
 *     городов (данные по гмц/приложение К СП 20.13330), γc=1.4, μ=1.1.
 *   - 'Подбор прогонов'!B12: "Нагрузка на покрытие" =
 *       (Sg * γc * μ * cos(уклон) + пригруз_от_ветра) * 100   [кг/м²]
 *   - 'Подбор прогонов'!B7: собственный вес покрытия (кг/м²), из
 *     справочника по типу кровли (см. roofingSelfWeight.json) —
 *     добавляется отдельно на этапе расчёта нагрузки на конкретный
 *     прогон (см. purlin/selectPurlin.ts), а не в B12.
 *
 * ОТКРЫТОЕ ДОПУЩЕНИЕ: коэффициент надёжности по ответственности γn
 * (вывод!D7) в формуле B12 явно не участвует — в исходном файле не
 * удалось однозначно проследить, где именно он применяется (возможно,
 * он входит в характеристики самого профиля через "Расчеты", а не в
 * нагрузку). Здесь γn пока не применяется к нагрузке; это нужно
 * перепроверить на реальном примере с k=0,8.
 */

export interface RoofLoadInput {
  /** Нормативный вес снегового покрова Sg, кПа. */
  sgKpa: number;
  /** Коэффициент надёжности по снеговой нагрузке (СП 20.13330), по умолчанию 1.4. */
  gammaC?: number;
  /** Коэффициент перехода от веса снегового покрова земли к нагрузке на покрытие, по умолчанию 1.1. */
  mu?: number;
  /** Уклон кровли, градусы. */
  roofSlopeDeg: number;
  /** Ветровой пригруз, кПа (в исходном файле — фиксированные 0.2 кПа). */
  windSurcharge_kPa?: number;
  /** Собственный вес покрытия, кг/м² (см. roofingSelfWeight.json). */
  selfWeight_kg_m2: number;
}

export interface RoofLoadResult {
  snow_kg_m2: number;
  wind_kg_m2: number;
  dead_kg_m2: number;
  /** Суммарная расчётная нагрузка на кровлю, кг/м². */
  total_kg_m2: number;
  /** То же в кПа (кН/м²), для расчёта усилий в прогонах. */
  total_kPa: number;
}

const KPA_TO_KGF_M2 = 100; // приближение 1 кПа ≈ 100 кгс/м², как в исходном файле

export function computeRoofLoad(input: RoofLoadInput): RoofLoadResult {
  const gammaC = input.gammaC ?? 1.4;
  const mu = input.mu ?? 1.1;
  const windSurcharge_kPa = input.windSurcharge_kPa ?? 0.2;

  const slopeRad = (input.roofSlopeDeg * Math.PI) / 180;
  const snow_kg_m2 = input.sgKpa * gammaC * mu * Math.cos(slopeRad) * KPA_TO_KGF_M2;
  const wind_kg_m2 = windSurcharge_kPa * KPA_TO_KGF_M2;
  const dead_kg_m2 = input.selfWeight_kg_m2;

  const total_kg_m2 = snow_kg_m2 + wind_kg_m2 + dead_kg_m2;

  return {
    snow_kg_m2,
    wind_kg_m2,
    dead_kg_m2,
    total_kg_m2,
    total_kPa: total_kg_m2 / KPA_TO_KGF_M2,
  };
}

/** Уклон кровли по умолчанию: 6° при пролёте >21м, иначе 15° ('Подбор прогонов'!B9). */
export function defaultRoofSlopeDeg(span_m: number): number {
  return span_m > 21 ? 6 : 15;
}
