import type { Span } from "../../types/common";
import type { BuildingGeometry } from "./types";

export interface FrameFastenersTakeoff {
  /** Кол-во "Фс11, Фс14" на здание, шт. */
  fc11_14Count: number;
  /** Кол-во "Фс12" на здание, шт (= 2 × fc11_14Count). */
  fc12Count: number;
  fc11_14Mass_kg: number;
  fc12Mass_kg: number;
  /** Кол-во "Саморез 5,5x25" на здание, шт (= кол-во рам × ставка по пролёту). */
  screw525Count: number;
  screw525Mass_kg: number;
  /** true, если ставка для этого пролёта не подтверждена примером и взята с ближайшего известного. */
  screw525RateIsEstimated: boolean;
  /** Кол-во "Болт М16х50" на здание, шт (= кол-во рам × ставка по пролёту). */
  boltM16Count: number;
  boltM16Mass_kg: number;
  /** true, если ставка для этого пролёта не подтверждена и взята с ближайшего известного. */
  boltM16RateIsEstimated: boolean;
  /** Кол-во "Болт М12х40" на здание, шт (= кол-во рам × ставка по пролёту). */
  boltM12Count: number;
  boltM12Mass_kg: number;
  /** true, если ставка для этого пролёта подтверждена только одним примером или не подтверждена вовсе. */
  boltM12RateIsEstimated: boolean;
  totalMass_kg: number;
}

/** Масса одной единицы, кг — литеральные значения из файла "22316" ("12м"!H29/H30), не из внешнего прайса. */
const FC11_14_UNIT_MASS_KG = 1.4;
const FC12_UNIT_MASS_KG = 0.5;
/** Масса одного самореза 5,5x25, кг — литеральное значение из файла "22316" ("12м"!H85). */
const SCREW_525_UNIT_MASS_KG = 0.0043;

/**
 * Ставка "саморезов 5,5x25 на одну раму" по пролёту — вручную вбитая
 * оценщиком константа в исходных ведомостях (не выводится формулой из
 * геометрии). Подтверждено на 4 реальных примерах (файл "22318",
 * листы "1ск"/15/18/21, формулы C85 вида "=K90*634"):
 *
 *   12м -> 530, 15м -> 614, 18м -> 634, 21м -> 890
 *
 * Для 9м и 24м подтверждённых примеров нет — берём ближайшую известную
 * ставку (см. screw525RateIsEstimated).
 */
const SCREW_525_RATE_BY_SPAN: Partial<Record<Span, number>> = {
  12: 530,
  15: 614,
  18: 634,
  21: 890,
};

function screw525Rate(span: Span): { rate: number; isEstimated: boolean } {
  const known = SCREW_525_RATE_BY_SPAN[span];
  if (known !== undefined) return { rate: known, isEstimated: false };
  // 9м ближе к 12м (530), 24м ближе к 21м (890) — не подтверждено примером.
  return { rate: span < 12 ? 530 : 890, isEstimated: true };
}

/** Масса одного болта М16х50, кг — литеральное значение из файла "22318" (H93). */
const BOLT_M16_UNIT_MASS_KG = 0.12;

/**
 * "Болт М16х50 (на раму)" — формула из ячейки O88, одинаковая в обоих
 * реальных проектах (файлы "22316" и "22318", лист "12м" — расчётчик
 * всегда работает на листе с этим названием, независимо от фактического
 * пролёта, поэтому остальные листы файла "22318" — шаблонные остатки и
 * источником не служат):
 *
 *   на_раму = base + coef×(рам−2)/рам + 12×8/рам + 12×2/рам
 *   всего   = на_раму × кол-во рам
 *
 * Подтверждено на двух реальных проектах:
 *   пролёт 15м: base=276, coef=30, рам=7 -> 314,57 на раму (всего 2202)
 *   пролёт 18м: base=308, coef=50, рам=8 -> 360,50 на раму (всего 2884)
 *
 * coef совпадает с рукописной запиской (30 для 9/12/15м, 50 для 18/21м) —
 * то есть в записке именно этот коэффициент, а не итог на раму.
 */
const BOLT_M16_COEF_BY_SPAN: Record<Span, number> = {
  9: 30,
  12: 30,
  15: 30,
  18: 50,
  21: 50,
  // 24м в записке нет — берём как у 21м.
  24: 50,
};

/** base известен только для 15м и 18м (два реальных проекта). */
const BOLT_M16_BASE_BY_SPAN: Partial<Record<Span, number>> = {
  15: 276,
  18: 308,
};

function boltM16PerFrame(span: Span, frameCount: number): { perFrame: number; isEstimated: boolean } {
  const knownBase = BOLT_M16_BASE_BY_SPAN[span];
  // Для остальных пролётов base линейно экстраполируется по двум
  // известным точкам (32 кг на 3 метра пролёта ≈ 10,67 на метр).
  const base = knownBase ?? 276 + ((span - 15) * 32) / 3;
  const coef = BOLT_M16_COEF_BY_SPAN[span];
  const perFrame =
    base + (coef * (frameCount - 2)) / frameCount + (12 * 8) / frameCount + (12 * 2) / frameCount;
  return { perFrame, isEstimated: knownBase === undefined };
}

/** Масса одного болта М12х40, кг — литеральное значение из файла "22318" (H87). */
const BOLT_M12_UNIT_MASS_KG = 0.05;

/**
 * Ставка "болтов М12х40 на одну раму" — "=16*K90" в обоих реальных
 * проектах (пролёт 15м и пролёт 18м), то есть от пролёта не зависит.
 *
 * Шаблонные (нерабочие) листы файла "22318" дают другие значения — 17
 * для 12м и 25 для 21м — но проектными данными они не подтверждены, и
 * источником не считаются. Поэтому для 9/12/21/24м берём те же 16 с
 * флагом boltM12RateIsEstimated.
 */
const BOLT_M12_RATE_PER_FRAME = 16;
const BOLT_M12_CONFIRMED_SPANS: readonly Span[] = [15, 18];

/**
 * Крепёж каркаса "Фс11/Фс14" и "Фс12" — количество по формуле,
 * подтверждённой на реальном примере из файла "22316" ("12м"!C29/C30):
 *
 *   Фс11,Фс14 = кол-во_рам × (пролёт + 2×высота) / 0,6
 *   Фс12      = 2 × Фс11,Фс14
 *
 * Проверено: пролёт=18, высота=5, рам=8 -> 8×(18+10)/0,6 = 373,33 —
 * совпадает со значением в исходной ведомости (373 шт, Фс12=747 шт).
 *
 * ОТКРЫТЫЙ ВОПРОС: точное физическое назначение "Фс11/Фс14/Фс12" не
 * подтверждено (буквальное название в файле — просто код позиции;
 * судя по массе ~1,4 и ~0,5 кг за штуку, это, вероятно, не саморезы,
 * а какой-то крепёжный элемент/кронштейн покрупнее). Цена неизвестна
 * — в исходном файле ссылается на отсутствующий у нас внешний прайс
 * "[1]Основные".
 */
export function computeFrameFasteners(
  geometry: Pick<BuildingGeometry, "span_m" | "height_m"> & { span_m: Span },
  frameCount: number,
): FrameFastenersTakeoff {
  const fc11_14Count = (frameCount * (geometry.span_m + 2 * geometry.height_m)) / 0.6;
  const fc12Count = 2 * fc11_14Count;

  const fc11_14Mass_kg = fc11_14Count * FC11_14_UNIT_MASS_KG;
  const fc12Mass_kg = fc12Count * FC12_UNIT_MASS_KG;

  const { rate, isEstimated } = screw525Rate(geometry.span_m);
  const screw525Count = frameCount * rate;
  const screw525Mass_kg = screw525Count * SCREW_525_UNIT_MASS_KG;

  const { perFrame: boltM16PerFrameCount, isEstimated: boltIsEstimated } = boltM16PerFrame(
    geometry.span_m,
    frameCount,
  );
  const boltM16Count = frameCount * boltM16PerFrameCount;
  const boltM16Mass_kg = boltM16Count * BOLT_M16_UNIT_MASS_KG;

  const boltM12Count = frameCount * BOLT_M12_RATE_PER_FRAME;
  const boltM12Mass_kg = boltM12Count * BOLT_M12_UNIT_MASS_KG;
  const boltM12IsEstimated = !BOLT_M12_CONFIRMED_SPANS.includes(geometry.span_m);

  return {
    fc11_14Count,
    fc12Count,
    fc11_14Mass_kg,
    fc12Mass_kg,
    screw525Count,
    screw525Mass_kg,
    screw525RateIsEstimated: isEstimated,
    boltM16Count,
    boltM16Mass_kg,
    boltM16RateIsEstimated: boltIsEstimated,
    boltM12Count,
    boltM12Mass_kg,
    boltM12RateIsEstimated: boltM12IsEstimated,
    totalMass_kg:
      fc11_14Mass_kg + fc12Mass_kg + screw525Mass_kg + boltM16Mass_kg + boltM12Mass_kg,
  };
}
