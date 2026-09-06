export type PurlinSteelSeries = "МП350" | "МП390";

export type PurlinFamily = "2ТПС" | "2ПС" | "Z";

export interface PurlinProfile {
  /** Название профиля, например "2ТПС 145х45х1,5". */
  name: string;
  /** Семейство: 2ТПС / 2ПС / Z — определяется по префиксу имени. */
  family: PurlinFamily;
  series: PurlinSteelSeries;
  /** Предельный изгибающий момент, кН·м (при коэффициенте использования "по умолчанию"). */
  limitMoment_kNm: number;
  /** Масса погонного метра, кг/м. */
  mass_kg_per_m: number;
  /**
   * Толщина утеплителя "нашей послойки", под которую рассчитан профиль, мм.
   * Проставлена только у 2ТПС; у 2ПС и Z — null.
   */
  insulationThickness_mm: number | null;
}

export interface PurlinSelectionInput {
  /** Пролёт (ширина) здания, м. */
  span_m: number;
  /** Шаг рам, м — он же расчётный пролёт прогона. */
  framePitch_m: number;
  /** Расчётная снеговая нагрузка Sg, кН/м² ('Расчеты'!C8). */
  snowLoad_kPa: number;
  /** Собственный вес покрытия, кг/м² ('Подбор прогонов'!B7). */
  roofingSelfWeight_kg_m2: number;
  /** Уклон кровли, градусы. */
  roofSlopeDeg: number;
  /** γn — коэффициент надёжности по ответственности (1,0 или 0,8). */
  gammaN: number;
  /** Максимальный шаг прогонов, мм — см. maxPurlinStepByDecking(). */
  maxStep_mm: number;
  /** Минимальный шаг прогонов, мм (в исходнике задаётся только для "Великана"). */
  minStep_mm?: number;
  /** Есть ли прогон под снегозадержание ('Подбор прогонов'!B16). */
  snowGuardPurlin: boolean;
  /** Есть ли прогон под ограждение ('Подбор прогонов'!B17). */
  railingPurlin?: boolean;
  /** Семейство профилей, разрешённое типом покрытия — см. purlinFamilyForRoofing(). */
  family: PurlinFamily;
  /** Толщина утеплителя "нашей послойки", мм; 0 — фильтр по толщине не применяется. */
  insulationThickness_mm?: number;
  /** Двускатное здание (по умолчанию да). */
  gable?: boolean;
}

export interface PurlinSeriesResult {
  profile: PurlinProfile;
  /** Принятый шаг прогонов, мм. */
  step_mm: number;
  /**
   * Число линий прогонов на один скат, с учётом добавок под
   * снегозадержание и ограждение. Дробное (…,5) — так считает исходник.
   */
  linesPerSlope: number;
  /** Масса прогонов на один шаг рам, кг ('Подбор прогонов'!G). */
  massPerBay_kg: number;
  /** Масса прогонов на здание, кг ('Подбор прогонов'!H). */
  massPerBuilding_kg: number;
}

export interface PurlinSelectionResult extends PurlinSeriesResult {
  /** Вариант из второй серии стали — тот, что проиграл по массе. */
  runnerUp: PurlinSeriesResult | null;
  /** Масса прогонов на 1 м² здания, кг/м² — критерий сравнения серий ('Подбор прогонов'!L). */
  massPerBuildingArea_kg_m2: number;
}
