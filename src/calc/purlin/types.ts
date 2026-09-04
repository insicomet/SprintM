export type PurlinSteelSeries = "МП350" | "МП390";

export interface PurlinProfile {
  /** Название профиля, например "2ТПС 145х45х1,5". */
  name: string;
  /** Семейство: 2ТПС / 2ПС / Z — определяется по префиксу имени. */
  family: "2ТПС" | "2ПС" | "Z";
  series: PurlinSteelSeries;
  /** Предельный изгибающий момент, кН·м (при коэффициенте использования "по умолчанию"). */
  limitMoment_kNm: number;
  /** Масса погонного метра, кг/м. */
  mass_kg_per_m: number;
}

export interface PurlinSelectionInput {
  /** Расчётная нагрузка на кровлю, кПа (кН/м²) — см. computeRoofLoad(). */
  roofLoad_kPa: number;
  /** Пролёт прогона = шаг рам, м. */
  framePitch_m: number;
  /** Минимальный допустимый шаг прогонов, мм. */
  minStep_mm: number;
  /** Максимальный допустимый шаг прогонов, мм ("вывод"!D23 / вручную заданный максимум). */
  maxStep_mm: number;
  /**
   * Коэффициент неразрезности — снижает расчётный момент для многопролётных
   * прогонов по сравнению с однопролётной балкой ('Расчеты'!C7, обычно 1.13).
   */
  continuityFactor?: number;
  /** Ограничить подбор одной серией стали; по умолчанию — обе, выбирается легче. */
  series?: PurlinSteelSeries;
}

export interface PurlinSelectionResult {
  profile: PurlinProfile;
  /** Принятый шаг прогонов, мм (не больше maxStep_mm и не больше шага "по несущей способности"). */
  step_mm: number;
  /** Максимальный шаг, который держит этот профиль при данной нагрузке, мм — до ограничения maxStep_mm. */
  maxCapableStep_mm: number;
  /** Масса прогонов на 1 м² кровли, кг/м² — критерий сравнения вариантов. */
  massPerRoofArea_kg_m2: number;
}
