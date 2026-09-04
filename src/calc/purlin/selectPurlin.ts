import { getPurlinCatalog } from "./catalog";
import type { PurlinSelectionInput, PurlinSelectionResult } from "./types";

/**
 * Подбор прогона: для каждого кандидата из каталога вычисляется
 * максимальный шаг, который он держит при заданной нагрузке и пролёте
 * (=шагу рам), затем среди подходящих (шаг в допустимых пределах)
 * выбирается вариант с наименьшим расходом стали на 1 м² кровли
 * (масса погонного метра / принятый шаг).
 *
 * Модель усилий: прогон — многопролётная неразрезная балка под
 * равномерной нагрузкой q = roofLoad_kPa * step;
 *   M = q * framePitch² / (8 * continuityFactor)
 * (то же соотношение, что использует исходный файл ИНСИ —
 * 'Расчеты'!C7 "к-т неразрезности" снижает момент относительно
 * однопролётной балки). Отсюда, при заданной предельной несущей
 * способности профиля M_pred, максимальный шаг:
 *   step_max = M_pred * 8 * continuityFactor / (roofLoad_kPa * framePitch²)
 *
 * ОТКРЫТОЕ ДОПУЩЕНИЕ: это не побайтовое повторение формул листа
 * "Подбор прогонов" (там — прямой перебор шага с 5-мм шагом по
 * готовой таблице несущей способности), а самостоятельная реализация
 * по той же механике. Нужно свериться с реальными примерами из
 * исходного файла, когда они появятся.
 */
export function selectPurlin(input: PurlinSelectionInput): PurlinSelectionResult | undefined {
  const continuityFactor = input.continuityFactor ?? 1.13;
  const candidates = getPurlinCatalog(input.series);

  let best: PurlinSelectionResult | undefined;

  for (const profile of candidates) {
    const maxCapableStep_m =
      (profile.limitMoment_kNm * 8 * continuityFactor) /
      (input.roofLoad_kPa * input.framePitch_m * input.framePitch_m);
    const maxCapableStep_mm = maxCapableStep_m * 1000;

    if (maxCapableStep_mm < input.minStep_mm) continue; // даже минимальный шаг не выдерживает

    const step_mm = Math.min(maxCapableStep_mm, input.maxStep_mm);
    if (step_mm < input.minStep_mm) continue;

    const massPerRoofArea_kg_m2 = profile.mass_kg_per_m / (step_mm / 1000);

    if (!best || massPerRoofArea_kg_m2 < best.massPerRoofArea_kg_m2) {
      best = { profile, step_mm, maxCapableStep_mm, massPerRoofArea_kg_m2 };
    }
  }

  return best;
}
