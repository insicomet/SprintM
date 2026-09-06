import type { ResponsibilityLevel, Span } from "../../types/common";

/**
 * Отображение фактической высоты здания на "высотную корзину" банка
 * сечений: [максимальная высота включительно, корзина].
 *
 * Пороги взяты из формул подборщика (лист "подбор", ячейки AN9:AN15):
 *
 *   AN9  = ЕСЛИ(пролёт>21; AN10; ЕСЛИ(высота<=3,8; 3,6; AN10))
 *   AN10 = ЕСЛИ(пролёт>21; AN11; ЕСЛИ(высота<=5;   4,8; AN11))
 *   AN11 = ЕСЛИ(высота<=6,2; 6; AN12)   ... и далее 7 / 8 / 9
 *
 * Обратите внимание: порог на 0,2м выше самой корзины (3,6 → до 3,8;
 * 4,8 → до 5,0; 6,0 → до 6,2). Поэтому здание высотой 5м попадает в
 * корзину 4,8, а не 6 — именно так посчитаны оба реальных проекта
 * ("Ангар теплый АТ 18х30х4,8(h)" при введённой высоте 5).
 */
export const HEIGHT_BUCKETS_9_21: readonly (readonly [number, number])[] = [
  [3.8, 3.6],
  [5.0, 4.8],
  [6.2, 6.0],
];

/**
 * То же для пролёта 24м: первые две ветки формулы пропускаются при
 * пролёте >21, поэтому корзины начинаются с 6. Соответствует примечанию
 * в исходнике: "пролет 21 до высоты 6,2м; пролет 21,1-24 высота до 9 м".
 */
export const HEIGHT_BUCKETS_24: readonly (readonly [number, number])[] = [
  [6.2, 6],
  [7, 7],
  [8, 8],
  [9, 9],
];

/** Один вариант сечений рамы для (пролёт, высота, k, с/в). */
export interface FrameSelection {
  span: Span;
  responsibility: ResponsibilityLevel;
  /** Высотная корзина, м (не обязательно фактическая высота здания — см. snapHeight). */
  heightBucket: number;
  /** "стандарт" или альтернативный вариант конструктива (напр. со шпренгельной затяжкой, только 24м). */
  variant: string;
  svCode: string;
  framePitch_m: number;
  column: { profile: string; utilizationPercent: number };
  beam: { profile: string; utilizationPercent: number };
  /** Прогон — отсутствует в данных для пролёта 24м (считается отдельно). */
  purlin: { profile: string; utilizationPercent: number } | null;
  bolts: {
    beamRidge: string;
    beamEave: string;
    columnBase: string;
    columnEave: string;
    totalInFrame: number;
  };
  massZinc_kg: number | null;
  massGussetPlates_kg: number | null;
}
