/** Уровень ответственности здания по ГОСТ 27751: k=1,0 (II) или k=0,8 (III). */
export type ResponsibilityLevel = 1.0 | 0.8;

/** Стандартные пролёты ангаров ИНСИ «Спринт М», м. */
export type Span = 9 | 12 | 15 | 18 | 21 | 24;

export const SPANS: readonly Span[] = [9, 12, 15, 18, 21, 24];
