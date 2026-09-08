import type { SettlementClimate } from "./types";

/**
 * Ветровое давление w0 по району, кПа — таблица СП 20.13330.
 *
 * Значения не выписаны из книжки, а сняты с нашего же справочника: у
 * 1096 городов район и давление связаны один в один, и связь совпадает с
 * табличной. Исключение — четыре записи (Бодайбо, Ленск, Мирный,
 * Олёкминск), где при районе II и VI стоит 0,17; это похоже на ошибку в
 * самих данных, здесь берём табличное значение района.
 */
const WIND_PRESSURE_BY_DISTRICT: Record<string, number> = {
  Ia: 0.17,
  I: 0.23,
  II: 0.3,
  III: 0.38,
  IV: 0.48,
  V: 0.6,
  VI: 0.73,
  VII: 0.85,
};

/** Ветровые районы, которые можно выбрать при ручном вводе. */
export const WIND_DISTRICTS = Object.keys(WIND_PRESSURE_BY_DISTRICT);

export function windPressureForDistrict_kPa(district: string): number | null {
  return WIND_PRESSURE_BY_DISTRICT[district] ?? null;
}

export interface ManualClimateInput {
  /** Расчётная снеговая нагрузка Sg, кПа — из проекта или у заказчика. */
  snowLoad_kPa: number;
  /** Ветровой район по СП 20.13330: «Ia», «I»…«VII». */
  windDistrict: string;
  /** Как назвать объект в расчёте; пусто — «Ручной ввод». */
  label?: string;
}

/**
 * Климат, введённый руками, — для площадок, которых нет в справочнике.
 *
 * Городов справочника это больше не касается: все 1096 доходят до
 * расчёта, а 47 на краю таблиц ИНСИ считаются по ближайшей строке с
 * пометкой «требует проверки» (указание проектировщика, вопрос 04).
 * Ручной ввод остался для другого — для площадки, которой в справочнике
 * просто нет: промзона, посёлок, объект за пределами России. Нагрузки
 * тогда берутся из ТЗ или у заказчика.
 *
 * Снеговой РАЙОН здесь не спрашивается: его, как и для найденного
 * города, выводит лестница нагрузок ИНСИ из самой нагрузки. Руками
 * задаются только два числа, которые есть в любом ТЗ, — снеговая
 * нагрузка и ветровой район.
 */
export function manualSettlement(input: ManualClimateInput): SettlementClimate {
  const w0Kpa = windPressureForDistrict_kPa(input.windDistrict);
  if (w0Kpa === null) {
    throw new Error(
      `Ветровой район «${input.windDistrict}» не из таблицы СП 20.13330 ` +
        `(допустимы ${WIND_DISTRICTS.join(", ")})`,
    );
  }
  if (!(input.snowLoad_kPa > 0)) {
    throw new Error("Снеговая нагрузка должна быть больше нуля");
  }

  return {
    id: "manual",
    settlement: input.label?.trim() || "Ручной ввод",
    region: "нагрузки заданы вручную",
    // Снеговой район остаётся неизвестным намеренно: и для найденного
    // города его выводит лестница нагрузок, а не справочник.
    snow: { region: null, sgKpa: input.snowLoad_kPa },
    wind: { region: input.windDistrict, w0Kpa },
  };
}
