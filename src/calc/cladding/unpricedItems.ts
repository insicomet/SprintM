import type { BuildingGeometry } from "../geometry/types";

export interface UnpricedItem {
  name: string;
  count: number;
  unit: string;
  /** Цена из кэша ведомости — она там есть, но в стоимость строки не заведена. */
  unitPrice: number;
  /** Сколько эта строка стоила бы, если бы её подключили к итогу. */
  wouldCost: number;
}

export interface UnpricedSection {
  section: "Стена" | "Кровля" | "Перекрытие";
  items: UnpricedItem[];
  /** Сумма, которой сейчас НЕТ в итоге расчётчика. */
  wouldAddCost: number;
}

/**
 * Позиции ведомости, у которых количество считается, а колонка стоимости
 * пустая — то есть в итог раздела они не попадают.
 *
 * Это не наша недоработка и не ошибка чтения: в обеих реальных ведомостях
 * ячейки F108…F110, F137, F143…F145 просто пустые, тогда как соседние
 * строки (панель, саморезы, шнур) формулу стоимости имеют. Поэтому итоги
 * разделов — «Итого стена» (F114) и «Итого кровля» (F147) — сходятся у нас
 * с расчётчиком до копейки БЕЗ этих строк.
 *
 * Считаем их отдельно, чтобы было видно, о каких деньгах речь: в "22316"
 * это ещё ≈352 тыс. ₽ по кровле и ≈571 тыс. ₽ по стене.
 *
 * Строки «Утеплитель», «ИзоспанВ» и «Изоспан АМ» в разделе «Стена»
 * заглушены прямо в формуле множителем ×0 (стена — сэндвич-панель,
 * утеплитель внутри неё), поэтому их здесь нет: они равны нулю всегда.
 */

/** Цены закэшированы в обеих ведомостях и совпадают. */
const PRICES = {
  gvl: 322.38333333333327,
  screw35x25: 0.9199999999999999,
  ps50x50: 241.5,
  roofInsulation: 3450,
  linotherm: 69,
  izospanV: 42,
  izospanAM: 89.14,
  // Раздел «Перекрытие» (строки 46–51 и 127–132).
  pgsS300x80x3: 2020.2,
  pgsS300x80x1_5: 1043.7,
  pgsS300x80x2: 1370.25,
  c44: 924.6114999999999,
  fc11_14: 291,
  fc12: 114,
  screw35x32: 0.9199999999999999,
  screw48x20: 2.3459999999999996,
  screw55x25: 2.2885,
} as const;

function item(name: string, count: number, unit: string, unitPrice: number): UnpricedItem {
  return { name, count, unit, unitPrice, wouldCost: count * unitPrice };
}

function section(name: UnpricedSection["section"], items: UnpricedItem[]): UnpricedSection {
  return { section: name, items, wouldAddCost: items.reduce((s, i) => s + i.wouldCost, 0) };
}

/**
 * Раздел «Стена», строки 108–110.
 *
 *   ГВЛ            = (пролёт + длина) × 2 × высота
 *   саморез 3,5х25 = 20 × ГВЛ
 *   ПС 50х50       = ГВЛ / 0,6 + пролёт × длина / 0,6
 *
 * Проверено: "22316" — 480 м², 9600 шт, 1700 п.м.;
 *            "22318" — 390 м², 7800 шт, 1250 п.м.
 */
export function computeWallUnpricedItems(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m" | "height_m">,
): UnpricedSection {
  const gvl = (geometry.span_m + geometry.length_m) * 2 * geometry.height_m;
  const footprint = geometry.span_m * geometry.length_m;

  return section("Стена", [
    item("ГВЛ", gvl, "м²", PRICES.gvl),
    item("саморез 3,5х25", 20 * gvl, "шт", PRICES.screw35x25),
    item("ПС 50х50 (под гвл)", gvl / 0.6 + footprint / 0.6, "п.м.", PRICES.ps50x50),
  ]);
}

/**
 * Раздел «Кровля», строки 137 и 143–145.
 *
 *   Утеплитель = (пролёт + 0,3) × длина × толщина_кровли / 1000 × 1,05
 *   Линотерм   = погонаж прогонов (та же ячейка, что и строка прогонов)
 *   ИзоспанВ   = пролёт × длина × 1,25
 *   Изоспан АМ = то же
 *
 * Проверено: "22316" — 86,4675 м³, 780 п.м., 675 м², 675 м²;
 *            "22318" — 57,834 м³, 480 п.м., 450 м², 450 м².
 */
export function computeRoofUnpricedItems(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m">,
  roofPanelThickness_mm: number,
  purlinProfileLength_m: number,
): UnpricedSection {
  const insulation_m3 =
    ((geometry.span_m + 0.3) * geometry.length_m * roofPanelThickness_mm * 1.05) / 1000;
  const izospan_m2 = geometry.span_m * geometry.length_m * 1.25;

  return section("Кровля", [
    item("Утеплитель", insulation_m3, "м³", PRICES.roofInsulation),
    item("Линотерм", purlinProfileLength_m, "п.м.", PRICES.linotherm),
    item("ИзоспанВ", izospan_m2, "м²", PRICES.izospanV),
    item("Изоспан АМ", izospan_m2, "м²", PRICES.izospanAM),
  ]);
}

/**
 * Раздел «Перекрытие» — строки 46–51 (несущее) и 127–132 (пирог).
 *
 * Количества считаются в ведомости всегда, независимо от того, есть в
 * объекте перекрытие или нет, а колонка стоимости пуста целиком, поэтому
 * «Итого перекрытие» (F53 и F134) в обоих проектах равны нулю.
 *
 *   ПГС-S 300х80х3   = 2 × пролёт × рам
 *   ПГС-S 300х80х1,5 = (пролёт / 1,5 + 1) × длина
 *   ПГС-S 300х80х2   = (рам − 2) × 2 × высота
 *   С-44 0,7 оц      = пролёт × длина × 1,1
 *   Фс11, Фс14       = (ПГС-S 300х80х3 + ПГС-S 300х80х2) / 2 / 0,6
 *   Фс12             = 2 × Фс11
 *   Утепление        = площадь × 0,2 × 1,05         (цена в ведомости 0)
 *   Изоспан В        = площадь × 2 × 1,2
 *   ГВЛ              = 3 × площадь
 *   Саморез 3,5×32   = 30 × ГВЛ
 *   Саморез 4,8×20   = 8 × С-44
 *   Саморез 5,5×25   = 20 × площадь
 *
 * Проверено: "22316" (18×30, h5, 8 рам) — 288 / 390 / 60 п.м., 594 м²,
 * 290 и 580 шт., 113,4 м³, 1296 и 1620 м², 48 600 / 4752 / 10 800 шт.;
 * "22318" (15×24, h5, 7 рам) — 210 / 264 / 50, 396, 216,67 и 433,33,
 * 75,6, 864 и 1080, 32 400 / 3168 / 7200.
 */
export function computeMezzanineItems(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m" | "height_m">,
  frameCount: number,
): UnpricedSection {
  const footprint = geometry.span_m * geometry.length_m;

  const pgs3 = 2 * geometry.span_m * frameCount;
  const pgs2 = (frameCount - 2) * 2 * geometry.height_m;
  const c44 = footprint * 1.1;
  const fc11_14 = (pgs3 + pgs2) / 2 / 0.6;
  const gvl = 3 * footprint;

  return section("Перекрытие", [
    item("ПГС-S 300х80х3", pgs3, "п.м.", PRICES.pgsS300x80x3),
    item("ПГС-S 300х80х1,5", (geometry.span_m / 1.5 + 1) * geometry.length_m, "п.м.", PRICES.pgsS300x80x1_5),
    item("ПГС-S 300х80х2", pgs2, "п.м.", PRICES.pgsS300x80x2),
    item("С-44 0,7 оц", c44, "м²", PRICES.c44),
    item("Фс11, Фс14", fc11_14, "шт", PRICES.fc11_14),
    item("Фс12", 2 * fc11_14, "шт", PRICES.fc12),
    item("Утепление", footprint * 0.2 * 1.05, "м³", 0),
    item("Изоспан В", footprint * 2 * 1.2, "м²", PRICES.izospanV),
    item("ГВЛ", gvl, "м²", PRICES.gvl),
    item("Саморез 3,5x32(45)", 30 * gvl, "шт", PRICES.screw35x32),
    item("Саморез 4,8x20", 8 * c44, "шт", PRICES.screw48x20),
    item("Саморез 5,5x25", 20 * footprint, "шт", PRICES.screw55x25),
  ]);
}
