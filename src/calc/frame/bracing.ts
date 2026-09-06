import type { Span } from "../../types/common";

/** Погонный вес квадратной трубы, т/п.м (ячейки L83:L85 ведомости). */
const TUBE_MASS_t_per_m = {
  "60х3": 0.00525,
  "80х3": 0.0072,
  "120х3": 0.011,
} as const;

export type StrutTube = keyof typeof TUBE_MASS_t_per_m;

/** Погонный вес уголка, т/п.м (столбец J ведомости, строки 85–97). */
const ANGLE_MASS_t_per_m = {
  "63х5": 0.00481,
  "80х4": 0.0096,
  "160х4": 0.0194,
} as const;

/**
 * Цены закэшированы в обеих ведомостях и совпадают
 * (E96 · E97 · E98 → книга «Перекупные»). Как и везде, пока берём кэш
 * ведомости, а не прайс.
 */
const PRICE_per_t = {
  tube: 136050,
  angle: 172500,
  plate: 137770,
} as const;

/**
 * «Вес фасонок на раму», кг (ячейка M87 — вбита вручную).
 * Известны только два пролёта из наших проектов.
 */
const GUSSET_MASS_PER_FRAME_kg: Partial<Record<Span, number>> = {
  15: 238,
  18: 264,
};

/** Связи, для которых горизонтальные и вертикальные диагонали всегда труба 80х3 (L85). */
const BRACE_TUBE: StrutTube = "80х3";
/** Надбавка на раскрой/стыки диагоналей — 1,1 в обеих ведомостях. */
const BRACE_ALLOWANCE = 1.1;

export interface BracingInput {
  span_m: Span;
  length_m: number;
  height_m: number;
  /** Шаг рам, м. */
  framePitch_m: number;
  frameCount: number;
  /** «Количество распорок из трубы» (K95) — вбито вручную, 3 в обоих проектах. */
  tubeStrutCount?: number;
  /** Труба распорок: 80х3 в "22316", 60х3 в "22318" — выбирается вручную. */
  strutTube?: StrutTube;
  /**
   * Слагаемое, вписанное в формулу руками: 0,432 т в "22316" и 0,795 т
   * в "22318". Правила для него не найдено — см. вопрос расчётчику.
   */
  extraTubeMass_t?: number;
  /** Периметр обрамления оконных проёмов, п.м (L156): 2 × (длина + ширина) × кол-во. */
  windowFramingPerimeter_m?: number;
}

export interface BracingItem {
  name: string;
  /** Количество, т. */
  mass_t: number | null;
  unitPrice_per_t: number;
  cost: number | null;
  /** Из чего сложилась масса — для показа и сверки. */
  breakdown?: { name: string; mass_t: number }[];
}

export interface BracingTakeoff {
  items: BracingItem[];
  totalMass_kg: number | null;
  /** Стоимость без накладных — накладные 2% начисляются на весь раздел F85:F98. */
  totalCost: number | null;
  /** Чего не хватает, если раздел неполный. */
  missing?: string;
}

/**
 * Связи, распорки и фасонки — строки 96–98 ведомости («Конструкции из
 * труб», «Уголок», «Лист»).
 *
 * Формулы сняты с обеих реальных ведомостей и воспроизводятся точно:
 *
 *   Конструкции из труб (т) =
 *       4 × (высота + 0,5) × 0,0194            стойки, уголок 160х4
 *     + масса_трубы × распорок × длина          распорки
 *     + 16 × √((пролёт/4)² + шаг²) × 0,0072 × 1,1   горизонтальные связи
 *     +  4 × √(высота²    + шаг²) × 0,0072 × 1,1   вертикальные связи
 *     + ручная добавка
 *     + 0,0096 × периметр обрамления окон        уголок 80х4
 *
 *   Уголок (т) = (рам − 2) × пролёт × 2 × 0,00481
 *
 *   Лист (т)   = рам × вес_фасонок_на_раму / 1000
 *
 * Сверка: "22316" (18×30, h5, шаг 4,5, 8 рам, распорки 80х3, добавка
 * 0,432 т, периметр окон 62 м) → 3,1215 т / 1,0390 т / 2,112 т.
 * "22318" (15×24, h5, шаг 4, 7 рам, распорки 60х3, добавка 0,795 т,
 * окон нет) → 2,4974 т / 0,7215 т / 1,666 т.
 *
 * ЧТО ЗАДАЁТСЯ ВРУЧНУЮ И ПРАВИЛА ДЛЯ ЭТОГО НЕТ:
 *   · слагаемое 0,432 / 0,795 т — зависимости от габаритов не видно;
 *   · размер трубы распорок (80х3 против 60х3);
 *   · их количество (3 в обоих проектах);
 *   · «вес фасонок на раму» — известен только для пролётов 15 и 18 м.
 * Без последнего строка «Лист» не считается, и раздел остаётся неполным.
 *
 * Шаг горизонтальной связи взят как пролёт/4: в ведомостях он вписан
 * числом (4,5 при пролёте 18 и 3,75 при пролёте 15), и оба раза это
 * ровно четверть пролёта.
 */
export function computeBracing(input: BracingInput): BracingTakeoff {
  const strutTube = input.strutTube ?? BRACE_TUBE;
  const strutCount = input.tubeStrutCount ?? 3;
  const extra_t = input.extraTubeMass_t ?? 0;
  const windowPerimeter_m = input.windowFramingPerimeter_m ?? 0;

  const braceTube_t_per_m = TUBE_MASS_t_per_m[BRACE_TUBE];
  const horizBraceLength_m = Math.hypot(input.span_m / 4, input.framePitch_m);
  const vertBraceLength_m = Math.hypot(input.height_m, input.framePitch_m);

  const tubeParts = [
    {
      name: "Стойки (уголок 160х4)",
      mass_t: 4 * (input.height_m + 0.5) * ANGLE_MASS_t_per_m["160х4"],
    },
    {
      name: `Распорки (труба ${strutTube})`,
      mass_t: TUBE_MASS_t_per_m[strutTube] * strutCount * input.length_m,
    },
    {
      name: "Горизонтальные связи",
      mass_t: 16 * horizBraceLength_m * braceTube_t_per_m * BRACE_ALLOWANCE,
    },
    {
      name: "Вертикальные связи",
      mass_t: 4 * vertBraceLength_m * braceTube_t_per_m * BRACE_ALLOWANCE,
    },
    { name: "Добавка (вручную)", mass_t: extra_t },
    {
      name: "Обрамление окон (уголок 80х4)",
      mass_t: ANGLE_MASS_t_per_m["80х4"] * windowPerimeter_m,
    },
  ];

  const tubeMass_t = tubeParts.reduce((s, p) => s + p.mass_t, 0);
  const angleMass_t =
    (input.frameCount - 2) * input.span_m * 2 * ANGLE_MASS_t_per_m["63х5"];

  const gusset_kg = GUSSET_MASS_PER_FRAME_kg[input.span_m];
  const plateMass_t = gusset_kg === undefined ? null : (input.frameCount * gusset_kg) / 1000;

  const items: BracingItem[] = [
    {
      name: "Конструкции из труб",
      mass_t: tubeMass_t,
      unitPrice_per_t: PRICE_per_t.tube,
      cost: tubeMass_t * PRICE_per_t.tube,
      breakdown: tubeParts.filter((p) => p.mass_t > 0),
    },
    {
      name: "Уголок",
      mass_t: angleMass_t,
      unitPrice_per_t: PRICE_per_t.angle,
      cost: angleMass_t * PRICE_per_t.angle,
    },
    {
      name: "Лист (фасонки)",
      mass_t: plateMass_t,
      unitPrice_per_t: PRICE_per_t.plate,
      cost: plateMass_t === null ? null : plateMass_t * PRICE_per_t.plate,
    },
  ];

  const incomplete = items.some((i) => i.cost === null);

  return {
    items,
    totalMass_kg: incomplete
      ? null
      : items.reduce((s, i) => s + (i.mass_t ?? 0), 0) * 1000,
    totalCost: incomplete ? null : items.reduce((s, i) => s + (i.cost ?? 0), 0),
    missing: incomplete ? `вес фасонок на раму для пролёта ${input.span_m} м` : undefined,
  };
}
