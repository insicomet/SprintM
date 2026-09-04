export interface FacadePostProfile {
  /** Название сечения, например "кв.120х4" (квадратная труба) или "пр.140х100х5" (прямоугольная). */
  section: string;
  steelGrade: string;
  /** Расчётное сопротивление стали Ry, МПа. */
  Ry_MPa: number;
  /** Масса погонного метра, кг/м. */
  mass_kg_per_m: number;
  /** Площадь сечения, см². */
  area_cm2: number;
  /** Момент сопротивления относительно оси X (плоскость изгиба от ветра), см³. */
  Wx_cm3: number;
  /** Момент сопротивления относительно оси Y, см³. */
  Wy_cm3: number;
  /** Радиус инерции относительно оси X, см (для проверки гибкости). */
  ix_cm: number;
  iy_cm: number;
}

export interface FacadePostSelectionInput {
  /** Ветровое давление (базовое, w0), кПа. */
  w0_kPa: number;
  /** Аэродинамический коэффициент — по умолчанию 0.8 (лобовое давление на плоскую стену). */
  aerodynamicCoef?: number;
  /** Шаг стоек (грузовая ширина), м. */
  postSpacing_m: number;
  /** Расчётная высота стойки, м. */
  height_m: number;
  /** Коэффициент запаса по моменту (γ), по умолчанию 1.0. */
  gammaM?: number;
}

export interface FacadePostSelectionResult {
  profile: FacadePostProfile;
  requiredWx_cm3: number;
  /** Ветровая нагрузка на стойку, кН/м (погонная, вдоль высоты). */
  windLoad_kN_per_m: number;
  /** Расчётный изгибающий момент, кН·м. */
  moment_kNm: number;
}
