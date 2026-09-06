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
  section: "Стена" | "Кровля";
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
