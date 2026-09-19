/**
 * Связи, распорки и фасонки для односкатного «Спринт СП» — «Конструкции
 * из труб», «Уголок», «Лист (фасонки)».
 *
 * ТОЛЬКО для простого случая: один пролёт, два столбца (низкий и
 * высокий), как в singleSlopeFrameGeometry.ts. НЕ для широких/составных
 * пролётов вида «18 (9х9)» — там появляется третья, центральная опора и
 * другие коэффициенты (см. вопрос расчётчику в questions.html); формула
 * ниже на таких объектах даст неверный результат и намеренно не
 * пытается их описать.
 *
 * Формула снята с реального объекта «21851» (Бирск, 12×30×7,5, 8 рам,
 * шаг 4,5) и воспроизводится точно, до 10-го знака:
 *
 *   Конструкции из труб (т) =
 *       2 × (низкая_высота + 1) × 0,018        стойки, труба 120х5
 *     + 0,0072 × распорок × длина               распорки, труба 80х3
 *     + 8 × гор_плечо                            горизонтальные связи, труба 120х3
 *     + 8 × верт_плечо                           вертикальные связи, труба 100х3
 *     + ручная добавка
 *     + 0,0096 × периметр обрамления окон        уголок 80х4
 *
 *   гор_плечо = √(катет_г² + шаг²) × 1,1 × 0,011, катет_г = пролёт/2 при
 *   пролёте ≤ 12 м и пролёт/4 при пролёте > 12 м — та же граница и та же
 *   логика, что у двускатного (см. bracing.ts, horizBraceRun_m).
 *   Подтверждено ЧИСЛОМ только на пролёте 12 (катет=6=пролёт/2) и на
 *   составном 18 (катет=4,5=пролёт/4, но там же и катет вертикальных
 *   связей совпал с горизонтальным — подозрительно, см. ниже); правило
 *   переносится по аналогии с двускатным, отдельно на простом случае с
 *   пролётом > 12 не проверено.
 *
 *   верт_плечо = √(катет_в² + шаг²) × 1,1 × 0,0091 — В РЕАЛЬНОМ ОБЪЕКТЕ
 *   «21851» катет_в = 4 (голое число, а не высота 7,5!), тогда как
 *   эталонный лист «1ск» ТОГО ЖЕ ФАЙЛА для этой же формулы использует
 *   катет_в = высота (там это работает, потому что в примере «1ск»
 *   высота как раз равна 3 — совпадение с любым «правдоподобным»
 *   числом не отличить). Похоже на ту же историю, что и с ошибкой
 *   периметра окон у двускатного (реальный лист разошёлся с шаблоном) —
 *   но здесь подтверждения от расчётчика нет, поэтому катет вертикальных
 *   связей оставлен ВХОДНЫМ параметром, а не выведенной формулой.
 *
 *   Уголок (т) = (рам−2) × 2 × 0,00481 × 1,05 × (пролёт + 3,5)
 *   Лист (т)   = рам × вес_фасонок_на_раму, т
 *
 * Сверка на «21851» (пролёт 12, длина 30, высота 7,5, шаг 4,5, 8 рам,
 * распорок 4, катет верт.связей 4, добавка 0,811 т, периметр окон 66 м,
 * фасонки 0,29 т/раму) → 3,8227454469348436 / 0,939393 / 2,32 —
 * совпадение с ведомостью до 10-го знака (см. test).
 *
 * ЧТО ЗАДАЁТСЯ ВРУЧНУЮ И ПРАВИЛА НЕТ:
 *   · слагаемое-добавка (0,811 в «21851», 0,735 в «22134» — по аналогии
 *     с extraTubeMass_t у двускатного, зависимости от габаритов не видно);
 *   · катет вертикальных связей (4 в «21851», см. оговорку выше);
 *   · количество распорок (4 здесь; у двускатного было 3 — тоже вручную);
 *   · «вес фасонок на раму» (0,29 т в «21851») — своей базы, аналогичной
 *     несушкам двускатного, для односкатного не собирали.
 *
 * Цены закэшированы в «21851» и «22134»: труба 132 830 ₽/т, уголок
 * 139 150 ₽/т, лист (фасонки) 126 500–132 250 ₽/т — отличаются от
 * констант bracing.ts (136 050 / 172 500 / 137 770), похоже на другую
 * версию прайса «Перекупные», не ошибка; интеграция стоимости в общий
 * расчёт — отдельный шаг, здесь считается только масса.
 */

const TUBE_MASS_t_per_m = {
  "80х3": 0.0072,
  "120х3": 0.011,
  "100х3": 0.0091,
  "120х5": 0.018,
} as const;

export type SingleSlopeTube = keyof typeof TUBE_MASS_t_per_m;

/** Уголок 63х5, т/п.м — то же значение, что и у двускатного (bracing.ts). */
const ANGLE_63X5_t_per_m = 0.00481;
/** Уголок 80х4, т/п.м — обрамление окон, то же значение, что и у двускатного. */
const ANGLE_80X4_t_per_m = 0.0096;

/** Надбавка на раскрой/стыки диагоналей — 1,1, как и у двускатного. */
const BRACE_ALLOWANCE = 1.1;

/** Коэффициент связей (горизонтальных и вертикальных) — фиксирован на простом случае (см. файл-докстринг). */
const BRACE_COEFF = 8;

/**
 * Катет горизонтальной связи — та же граница и та же логика, что у
 * двускатного (см. bracing.ts, horizBraceRun_m).
 */
function horizBraceRun_m(span_m: number): number {
  return span_m <= 12 ? span_m / 2 : span_m / 4;
}

export interface SingleSlopeBracingInput {
  span_m: number;
  length_m: number;
  /** Высота у низкого карниза (C10 ведомости). */
  lowHeight_m: number;
  /** Шаг рам, м. */
  framePitch_m: number;
  frameCount: number;
  /** Труба стоек — по умолчанию 120х5, как в «21851». */
  postsTube?: SingleSlopeTube;
  /** Труба распорок — по умолчанию 80х3, как в «21851». */
  strutTube?: SingleSlopeTube;
  /** «Количество распорок из трубы» — вбито вручную (4 в «21851»). */
  strutCount: number;
  /** Труба вертикальных связей — по умолчанию 100х3, как в «21851». */
  verticalBraceTube?: SingleSlopeTube;
  /** Катет вертикальных связей, м — вбит вручную, правила нет (см. докстринг файла). */
  verticalBraceLeg_m: number;
  /** Слагаемое, вписанное в формулу руками (0,811 т в «21851»). */
  extraTubeMass_t: number;
  /** «Металлоемкость узловых пластин», т на раму (0,29 в «21851»). */
  gussetMassPerFrame_t: number;
  /** Периметр обрамления оконных проёмов, п.м. */
  windowFramingPerimeter_m?: number;
}

export interface SingleSlopeBracingItem {
  name: string;
  mass_t: number;
  breakdown?: { name: string; mass_t: number }[];
}

export interface SingleSlopeBracingTakeoff {
  items: SingleSlopeBracingItem[];
  totalMass_kg: number;
}

export function computeSingleSlopeBracing(
  input: SingleSlopeBracingInput,
): SingleSlopeBracingTakeoff {
  const postsTube = input.postsTube ?? "120х5";
  const strutTube = input.strutTube ?? "80х3";
  const vertTube = input.verticalBraceTube ?? "100х3";
  const windowPerimeter_m = input.windowFramingPerimeter_m ?? 0;

  const horizBraceLength_m =
    Math.hypot(horizBraceRun_m(input.span_m), input.framePitch_m) * BRACE_ALLOWANCE;
  const vertBraceLength_m =
    Math.hypot(input.verticalBraceLeg_m, input.framePitch_m) * BRACE_ALLOWANCE;

  const tubeParts = [
    {
      name: `Стойки (труба ${postsTube})`,
      mass_t: 2 * (input.lowHeight_m + 1) * TUBE_MASS_t_per_m[postsTube],
    },
    {
      name: `Распорки (труба ${strutTube})`,
      mass_t: TUBE_MASS_t_per_m[strutTube] * input.strutCount * input.length_m,
    },
    {
      name: "Горизонтальные связи (труба 120х3)",
      mass_t: BRACE_COEFF * horizBraceLength_m * TUBE_MASS_t_per_m["120х3"],
    },
    {
      name: `Вертикальные связи (труба ${vertTube})`,
      mass_t: BRACE_COEFF * vertBraceLength_m * TUBE_MASS_t_per_m[vertTube],
    },
    { name: "Добавка (вручную)", mass_t: input.extraTubeMass_t },
    {
      name: "Обрамление окон (уголок 80х4)",
      mass_t: ANGLE_80X4_t_per_m * windowPerimeter_m,
    },
  ];

  const tubeMass_t = tubeParts.reduce((s, p) => s + p.mass_t, 0);

  const angleMass_t =
    (input.frameCount - 2) * 2 * ANGLE_63X5_t_per_m * 1.05 * (input.span_m + 3.5);

  const plateMass_t = input.frameCount * input.gussetMassPerFrame_t;

  const items: SingleSlopeBracingItem[] = [
    {
      name: "Конструкции из труб",
      mass_t: tubeMass_t,
      breakdown: tubeParts.filter((p) => p.mass_t > 0),
    },
    { name: "Уголок", mass_t: angleMass_t },
    { name: "Лист (фасонки)", mass_t: plateMass_t },
  ];

  return {
    items,
    totalMass_kg: items.reduce((s, i) => s + i.mass_t, 0) * 1000,
  };
}
