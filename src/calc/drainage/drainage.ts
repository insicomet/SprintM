import type { BuildingGeometry } from "../geometry/types";

export interface DrainageItem {
  name: string;
  /** Количество в единицах измерения — как в исходной ведомости, без округления. */
  count: number;
  unit: string;
  unitMass_kg: number;
  unitPrice: number;
  mass_kg: number;
  cost: number;
}

/** Раздела «Водосток» нет в проекте (ТЗ, п.14: «нет»). */
export const NO_DRAINAGE: DrainageTakeoff = {
  items: [],
  subtotalCost: 0,
  overheadCost: 0,
  totalCost: 0,
  totalMass_kg: 0,
};

export interface DrainageTakeoff {
  items: DrainageItem[];
  subtotalCost: number;
  /** Накладные расходы, ₽ — 2% от суммы позиций (строка "Накладные расходы:" в исходной ведомости). */
  overheadCost: number;
  totalCost: number;
  totalMass_kg: number;
}

/** Накладные расходы на раздел "Водосток" — 0,02 в обоих реальных проектах. */
const OVERHEAD_RATE = 0.02;

/**
 * Цена и масса единицы — раздел "Водосток" (система ф150мм).
 *
 * Значения совпадают в трёх местах: закэшированы в обеих реальных
 * ведомостях (ссылка "[6]Водосток(МП)"!E15:E23) и лежат в прайс-листе на
 * листе "Водосток" в столбце E ("МП ПРОЕКТ", строки 2–10) вместе с теми
 * же массами (столбец G).
 *
 * ВРЕМЕННОЕ РЕШЕНИЕ: значения захардкожены здесь, а не читаются из
 * прайса, — сознательно, чтобы итог приложения можно было сверить с
 * расчётом расчётчика позиция в позицию. После достижения полного
 * совпадения это нужно перевести на загрузку из прайса. Учесть, что в
 * прайсе на том же листе есть второй столбец цен ("Цена август 2025",
 * столбец J) с другими значениями — какой из них рабочий, вопрос открыт.
 */
const UNIT_MASS_AND_PRICE = {
  downpipe: { unitMass_kg: 1.5, unitPrice: 625 },
  gutter: { unitMass_kg: 1.5, unitPrice: 425 },
  downpipeBracket: { unitMass_kg: 0.5, unitPrice: 265 },
  gutterBracket: { unitMass_kg: 0.5, unitPrice: 325 },
  gutterEndCap: { unitMass_kg: 0.5, unitPrice: 90 },
  outletElbow: { unitMass_kg: 0.5, unitPrice: 410 },
  cornerElbow: { unitMass_kg: 0.5, unitPrice: 410 },
  gutterConnector: { unitMass_kg: 0.5, unitPrice: 345 },
  pipeAdapter: { unitMass_kg: 0.5, unitPrice: 531 },
} as const;

/** Excel CEILING(x, step) — округление вверх до кратного step. */
function ceilingToMultiple(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/**
 * Ведомость водостока (система ф150мм).
 *
 * Все формулы подтверждены дословным совпадением в обеих реальных
 * ведомостях (файлы "22316" и "22318", лист "12м"):
 *
 *   Колено сливное     = CEILING(пролёт × длина / 100; 2)
 *   Труба              = колено_сливное × высота
 *   Желоб              = 2 × длина
 *   Держатель трубы    = труба / 2
 *   Держатель желоба   = желоб / 0,7
 *   Заглушка желоба    = 4
 *   Колено угловое     = 2 × колено_сливное
 *   Соединитель желоба = желоб / 5
 *   Патрубок           = колено_сливное
 *
 * Дробные количества (держатели, соединители) в исходнике не
 * округляются — сохраняем это поведение, чтобы итоги совпадали.
 *
 * Контрольные значения: 22316 (18×30, h=5) -> 92 971,11 ₽ / 205,36 кг;
 * 22318 (15×24, h=5) -> 69 922,75 ₽ / 156,09 кг.
 */
export function computeDrainage(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m" | "height_m">,
): DrainageTakeoff {
  const { span_m, length_m, height_m } = geometry;

  const outletElbow = ceilingToMultiple((span_m * length_m) / 100, 2);
  const gutter = 2 * length_m;
  const downpipe = outletElbow * height_m;

  const counts: [string, string, keyof typeof UNIT_MASS_AND_PRICE, number][] = [
    ["Труба", "п.м.", "downpipe", downpipe],
    ["Желоб", "п.м.", "gutter", gutter],
    ["Держатель трубы", "шт.", "downpipeBracket", downpipe / 2],
    ["Держатель желоба", "шт.", "gutterBracket", gutter / 0.7],
    ["Заглушка желоба", "шт.", "gutterEndCap", 4],
    ["Колено сливное", "шт.", "outletElbow", outletElbow],
    ["Колено угловое", "шт.", "cornerElbow", 2 * outletElbow],
    ["Соединитель желоба", "шт.", "gutterConnector", gutter / 5],
    ["Патрубок", "шт.", "pipeAdapter", outletElbow],
  ];

  const items: DrainageItem[] = counts.map(([name, unit, key, count]) => {
    const { unitMass_kg, unitPrice } = UNIT_MASS_AND_PRICE[key];
    return {
      name,
      count,
      unit,
      unitMass_kg,
      unitPrice,
      mass_kg: count * unitMass_kg,
      cost: count * unitPrice,
    };
  });

  const subtotalCost = items.reduce((sum, i) => sum + i.cost, 0);
  const overheadCost = subtotalCost * OVERHEAD_RATE;

  return {
    items,
    subtotalCost,
    overheadCost,
    totalCost: subtotalCost + overheadCost,
    totalMass_kg: items.reduce((sum, i) => sum + i.mass_kg, 0),
  };
}
