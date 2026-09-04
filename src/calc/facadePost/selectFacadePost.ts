import { getFacadePostCatalog } from "./catalog";
import type { FacadePostSelectionInput, FacadePostSelectionResult } from "./types";

/**
 * Подбор стойки фахверка (простенка) под ветровую нагрузку.
 *
 * Модель: стойка — однопролётная балка высотой height_m, нагруженная
 * равномерным ветровым давлением по грузовой ширине postSpacing_m;
 * M = q * height² / 8. Профиль проходит, если Wx ≥ M / Ry (проверка
 * только по прочности при изгибе — без учёта устойчивости/гибкости
 * стойки как сжато-изогнутого элемента и без учёта продольной силы
 * от собственного веса стены).
 *
 * ОТКРЫТЫЕ ДОПУЩЕНИЯ (в отличие от прогонов, здесь не с чем сверяться
 * по исходному файлу — методика "Расчет" в ИНСИ выполняет более
 * полную проверку сжато-изогнутого стержня):
 *  - аэродинамический коэффициент берётся постоянным (0.8), без учёта
 *    зон (наветренная/подветренная/угловая) и высотного коэффициента k(z);
 *  - не проверяется гибкость (ix/iy) и работа на сжатие от веса
 *    вышележащих конструкций.
 * Результат стоит считать оценочным до сверки с реальным примером.
 */
export function selectFacadePost(input: FacadePostSelectionInput): FacadePostSelectionResult | undefined {
  const aerodynamicCoef = input.aerodynamicCoef ?? 0.8;
  const gammaM = input.gammaM ?? 1.0;

  const windLoad_kN_per_m = input.w0_kPa * aerodynamicCoef * input.postSpacing_m;
  const moment_kNm = (windLoad_kN_per_m * input.height_m * input.height_m) / 8;

  // M [кН·м] -> [Н·мм] = *1e6; Ry [МПа=Н/мм²]; Wx_required [мм³] = M·γ/Ry; -> [см³] = /1000
  // т.е. Wx_required[см³] = M[кН·м] * 1000 * γ / Ry[МПа]
  for (const profile of getFacadePostCatalog()) {
    const requiredWx_cm3 = (moment_kNm * 1000 * gammaM) / profile.Ry_MPa;
    if (profile.Wx_cm3 >= requiredWx_cm3) {
      return { profile, requiredWx_cm3, windLoad_kN_per_m, moment_kNm };
    }
  }
  return undefined;
}
