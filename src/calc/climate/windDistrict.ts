import { windPressureForDistrict_kPa } from "./manualClimate";
import type { SettlementClimate } from "./types";

export interface WindPick {
  district: string;
  w0Kpa: number;
  /**
   * null — район взят из справочника как есть. Иначе города в
   * справочнике нет с проставленным районом, и мы взяли самый тяжёлый из
   * тех, между которыми он лежит; расчёт помечается «требует проверки».
   */
  border: { between: readonly string[] } | null;
}

/**
 * Ветровой район города — со ссылкой на пограничную зону там, где район
 * не проставлен.
 *
 * Из 1096 городов справочника таких три: Дербент, Избербаш и
 * Багратионовск. Пустой район у них не пробел в данных, а сознательная
 * пометка «требует проверки»: города стоят на стыке районов, и по СП
 * там положено смотреть карту точнее. Считаем по самому тяжёлому из
 * пограничных — приблизительный расчёт не должен быть легче настоящего.
 */
export function resolveWindDistrict(city: SettlementClimate): WindPick | null {
  if (city.wind.region) {
    const w0 = city.wind.w0Kpa ?? windPressureForDistrict_kPa(city.wind.region);
    return w0 === null ? null : { district: city.wind.region, w0Kpa: w0, border: null };
  }

  const between = city.wind.borderRegions ?? [];
  const heaviest = [...between]
    .map((d) => ({ d, w0: windPressureForDistrict_kPa(d) }))
    .filter((x): x is { d: string; w0: number } => x.w0 !== null)
    .sort((a, b) => a.w0 - b.w0)
    .pop();
  if (!heaviest) return null;

  return { district: heaviest.d, w0Kpa: heaviest.w0, border: { between } };
}
