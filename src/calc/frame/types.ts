import type { ResponsibilityLevel, Span } from "../../types/common";

/** Доступные "высотные корзины" банка сечений для пролётов 9–21м, м. */
export const HEIGHT_BUCKETS_9_21: readonly number[] = [3.6, 4.8, 6.0];

/** Доступные высотные корзины для пролёта 24м, м. */
export const HEIGHT_BUCKETS_24: readonly number[] = [6, 7, 8, 9];

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
