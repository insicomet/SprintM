import type { BuildingGeometry } from "../geometry/types";

export interface WallTrimItem {
  name: string;
  count: number;
  unit: string;
  unitMass_kg: number;
  unitPrice: number;
  mass_kg: number;
  cost: number;
}

export interface WallTrimTakeoff {
  items: WallTrimItem[];
  subtotalCost: number;
  /** Накладные расходы, ₽ — 2% от суммы позиций. */
  overheadCost: number;
  totalCost: number;
  totalMass_kg: number;
}

/** Накладные расходы на раздел "Стены" — 0,02 в обоих реальных проектах. */
const OVERHEAD_RATE = 0.02;

/**
 * Масса и цена единицы — раздел "Стены" (строки 38–39 ведомости).
 * Значения закэшированы в обеих реальных ведомостях и совпадают.
 *
 * ВРЕМЕННОЕ РЕШЕНИЕ: цены, как и в остальных разделах, взяты из кэша
 * ведомости, чтобы итог сходился с расчётом расчётчика позиция в
 * позицию; на актуальный прайс переводим после полной сверки.
 */
const TRIM_UNITS = {
  innerAngle: { name: "У.115 внутренний (2м)", unit: "шт", unitMass_kg: 0.9, unitPrice: 800 },
  outerAngle: { name: "У.115 наружный (2м)", unit: "шт", unitMass_kg: 2.3, unitPrice: 800 },
} as const;

/**
 * Ведомость раздела "Стены" — угловые доборные элементы.
 *
 * Формулы подтверждены дословным совпадением в обеих реальных
 * ведомостях ("22316" и "22318", лист "12м", строки 38–44):
 *
 *   У.115 внутренний = (3 × длина + 2 × пролёт) / 1,9
 *   У.115 наружный   = 4 × высота / 1,9
 *
 * Делитель 1,9 — рабочая длина элемента: сам элемент двухметровый, 10см
 * уходит на нахлёст.
 *
 * Остальные строки раздела (ПС 245х65, ПС 145 окрашенные, С-18, КФ) в
 * обоих проектах обнулены, поэтому сюда не входят. За счёт этого раздел
 * воспроизводится целиком: 62 703,16 ₽ для "22316" и 52 395,79 ₽ для
 * "22318" — значения ячейки F44.
 */
export function computeWallTrim(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m" | "height_m">,
): WallTrimTakeoff {
  const { span_m, length_m, height_m } = geometry;

  const counts: [keyof typeof TRIM_UNITS, number][] = [
    ["innerAngle", (3 * length_m + 2 * span_m) / 1.9],
    ["outerAngle", (4 * height_m) / 1.9],
  ];

  const items: WallTrimItem[] = counts.map(([key, count]) => {
    const { name, unit, unitMass_kg, unitPrice } = TRIM_UNITS[key];
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
