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

/** Масса одного болта М16х50, кг — литеральное значение из файла "22318" (H83/H93). */
const BOLT_M16_UNIT_MASS_KG = 0.12;

/**
 * Ставка "болтов М16х50 на одну раму" по пролёту — предоставлена
 * пользователем (рукописная заметка) и подтверждена: значение 30 для
 * группы 9/12/15м совпадает с буквальным коэффициентом в формуле файла
 * "22318" (лист "12м", ячейка O88 = "=276+30*(K90-2)/K90+...").
 */
const BOLT_M16_RATE_BY_SPAN: Partial<Record<Span, number>> = {
  9: 30,
  12: 30,
  15: 30,
  18: 50,
  21: 50,
};

function boltM16Rate(span: Span): { rate: number; isEstimated: boolean } {
  const known = BOLT_M16_RATE_BY_SPAN[span];
  if (known !== undefined) return { rate: known, isEstimated: false };
  // 24м ближе к 21м (50) — не подтверждено примером.
  return { rate: 50, isEstimated: true };
}

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

  const { rate: boltRate, isEstimated: boltIsEstimated } = boltM16Rate(geometry.span_m);
  const boltM16Count = frameCount * boltRate;
  const boltM16Mass_kg = boltM16Count * BOLT_M16_UNIT_MASS_KG;

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
    totalMass_kg: fc11_14Mass_kg + fc12Mass_kg + screw525Mass_kg + boltM16Mass_kg,
  };
}
