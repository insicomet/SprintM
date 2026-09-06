export interface OpeningsInput {
  gatesCount: number;
  gateWidth_m: number;
  gateHeight_m: number;
  doorsCount: number;
  doorWidth_m: number;
  doorHeight_m: number;
  windowsCount: number;
  windowWidth_m: number;
  windowHeight_m: number;
}

export const DEFAULT_OPENINGS: OpeningsInput = {
  gatesCount: 1,
  gateWidth_m: 4,
  gateHeight_m: 4.5,
  doorsCount: 1,
  doorWidth_m: 1,
  doorHeight_m: 2.1,
  windowsCount: 0,
  windowWidth_m: 0,
  windowHeight_m: 0,
};

/** Суммарная площадь проёмов (ворота + двери + окна), м² — вычитается из площади стен под обшивку. */
export function computeOpeningsArea_m2(openings: OpeningsInput): number {
  return gatesArea_m2(openings) + doorsArea_m2(openings) + windowsArea_m2(openings);
}

function gatesArea_m2(o: OpeningsInput): number {
  return o.gatesCount * o.gateWidth_m * o.gateHeight_m;
}

function doorsArea_m2(o: OpeningsInput): number {
  return o.doorsCount * o.doorWidth_m * o.doorHeight_m;
}

export function windowsArea_m2(o: OpeningsInput): number {
  return o.windowsCount * o.windowWidth_m * o.windowHeight_m;
}

/**
 * Периметр обрамления оконных проёмов, п.м — по нему в ведомости идёт
 * уголок 80х4 в строке «Конструкции из труб»:
 *
 *   L156 = 2 × (ширина + высота) × количество
 *
 * В "22316" это 2 × (30 + 1) × 1 = 62 п.м, в "22318" окон нет → 0.
 */
export function windowFramingPerimeter_m(o: OpeningsInput): number {
  return 2 * (o.windowWidth_m + o.windowHeight_m) * o.windowsCount;
}

export interface OpeningsCostItem {
  name: string;
  area_m2: number;
  /** Цена за м² проёма — ворота и двери в исходнике тоже считаются по площади, не поштучно. */
  unitPrice: number;
  cost: number;
}

export interface OpeningsCost {
  items: OpeningsCostItem[];
  totalCost: number;
}

/**
 * Цены проёмов, ₽/м². Закэшированы в обеих реальных ведомостях (лист
 * "12м", ячейки N160/N162/N163) и совпадают.
 *
 * ВРЕМЕННОЕ РЕШЕНИЕ: как и в остальных разделах, взяты из кэша
 * ведомости, а не из прайса, чтобы итог сходился с расчётом расчётчика.
 */
const OPENING_PRICES = {
  windows: 6094.999999999999,
  doors: 29462.999999999996,
  gates: 40480,
} as const;

/**
 * Стоимость проёмов — отдельная строка коммерческого предложения,
 * которая не входит ни в материалы, ни в упаковку.
 *
 * В исходнике это блок "Проемы" (строки 160–163) с итогом в ячейке F160:
 *
 *   F160 = площадь_окон × цена + площадь_дверей × цена + площадь_ворот × цена
 *
 * Ворота и двери считаются по квадратуре так же, как окна.
 *
 * Контрольные значения: "22316" (окна 30 м², двери 2 м², ворота 16,8 м²)
 * -> 921 840 ₽; "22318" (дверь 2 м², ворота 18 м²) -> 787 566 ₽.
 */
export function computeOpeningsCost(openings: OpeningsInput): OpeningsCost {
  const items: OpeningsCostItem[] = [
    { name: "Окна", area_m2: windowsArea_m2(openings), unitPrice: OPENING_PRICES.windows },
    { name: "Двери", area_m2: doorsArea_m2(openings), unitPrice: OPENING_PRICES.doors },
    { name: "Ворота", area_m2: gatesArea_m2(openings), unitPrice: OPENING_PRICES.gates },
  ].map((i) => ({ ...i, cost: i.area_m2 * i.unitPrice }));

  return { items, totalCost: items.reduce((sum, i) => sum + i.cost, 0) };
}
