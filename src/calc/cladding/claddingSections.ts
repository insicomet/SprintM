import type { BuildingGeometry } from "../geometry/types";
import { rafterLengthPerFrame_m } from "../geometry/frameGeometry";
import { estimateSandwichPanelCladding } from "./sandwichPanel";

export interface CladdingItem {
  name: string;
  count: number;
  unit: string;
  /** null — если для этой толщины панели цены в прайсе нет (прочерк). */
  unitPrice: number | null;
  unitMass_kg: number;
  cost: number | null;
  mass_kg: number;
}

export interface CladdingSectionTakeoff {
  items: CladdingItem[];
  /** null — если хотя бы у одной позиции нет цены. */
  subtotalCost: number | null;
  overheadCost: number | null;
  totalCost: number | null;
  totalMass_kg: number;
}

/** Накладные расходы на разделы "Стена" и "Кровля" — 0,02 в обоих реальных проектах. */
const OVERHEAD_RATE = 0.02;

/**
 * Цена и масса крепежа панелей — закэшированы в обеих реальных
 * ведомостях и совпадают. Как и в остальных разделах, взяты из кэша
 * ведомости, а не из прайса, чтобы итог сходился с расчётом расчётчика.
 */
const WALL_SCREW = { name: "с/з 5,5х140", unitPrice: 51.9, unitMass_kg: 0.005 };
const ROOF_SCREW = { name: "с/з 5,5х190", unitPrice: 94.8, unitMass_kg: 0.005 };
/** БК шнур — уплотнительный шнур; массы в исходнике нет, считаем нулевой. */
const SEALANT_CORD = { name: "БК шнур", unitPrice: 63.3, unitMass_kg: 0 };

function buildSection(items: CladdingItem[]): CladdingSectionTakeoff {
  const anyUnpriced = items.some((i) => i.cost === null);
  const subtotalCost = anyUnpriced ? null : items.reduce((s, i) => s + (i.cost ?? 0), 0);
  const overheadCost = subtotalCost === null ? null : subtotalCost * OVERHEAD_RATE;
  return {
    items,
    subtotalCost,
    overheadCost,
    totalCost: subtotalCost === null || overheadCost === null ? null : subtotalCost + overheadCost,
    totalMass_kg: items.reduce((s, i) => s + i.mass_kg, 0),
  };
}

function simpleItem(
  spec: { name: string; unitPrice: number; unitMass_kg: number },
  count: number,
  unit: string,
): CladdingItem {
  return {
    name: spec.name,
    count,
    unit,
    unitPrice: spec.unitPrice,
    unitMass_kg: spec.unitMass_kg,
    cost: count * spec.unitPrice,
    mass_kg: count * spec.unitMass_kg,
  };
}

/**
 * Раздел "Стена" ведомости дополнительных материалов.
 *
 * Формулы подтверждены совпадением в обеих реальных ведомостях
 * ("22316" и "22318", лист "12м", строки 102–113):
 *
 *   СП          = площадь стен за вычетом проёмов
 *   с/з 5,5х140 = площадь_СП / шаг_рам × 6 × 1,1
 *   БК шнур     = ВВЕРХ(высота − 1) × (пролёт + длина) × 2 × 2 × 1,1
 *
 * Проверено на "22316" (18×30, высота 5, шаг 4,5, панель 504 м²):
 * 739,2 самореза и 844,8 п.м. шнура.
 *
 * Остальные строки раздела (утеплитель, ГВЛ, штрипс, Изоспан) в обоих
 * проектах либо обнулены, либо оставлены без формулы цены, поэтому сюда
 * не входят.
 */
export function computeWallCladdingSection(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m" | "height_m" | "framePitch_m">,
  netWallArea_m2: number,
  panelThickness_mm: number,
): CladdingSectionTakeoff {
  const panel = estimateSandwichPanelCladding(netWallArea_m2, panelThickness_mm, "wall", "zLock");

  const screwCount = (netWallArea_m2 / geometry.framePitch_m) * 6 * 1.1;
  const cordLength =
    Math.ceil(geometry.height_m - 1) * (geometry.span_m + geometry.length_m) * 2 * 2 * 1.1;

  return buildSection([
    {
      name: `СП ${panelThickness_mm} (стена, Z-lock)`,
      count: netWallArea_m2,
      unit: "м²",
      unitPrice: panel?.pricePerM2 ?? null,
      unitMass_kg: panel?.mass_kg != null && netWallArea_m2 > 0 ? panel.mass_kg / netWallArea_m2 : 0,
      cost: panel?.cost ?? null,
      mass_kg: panel?.mass_kg ?? 0,
    },
    simpleItem(WALL_SCREW, screwCount, "шт"),
    simpleItem(SEALANT_CORD, cordLength, "п.м."),
  ]);
}

/**
 * Раздел "Кровля" ведомости дополнительных материалов.
 *
 * Формулы подтверждены совпадением в обеих реальных ведомостях
 * (строки 136–146):
 *
 *   СП          = пролёт × длина × 1,03      (см. computeRoofArea_m2)
 *   с/з 5,5х190 = 2 × кол-во_прогонов × длина × 1,1
 *   БК шнур     = длина × длина_ригеля × 1,1 × 2
 *
 * Проверено на "22316" (18×30, 12 прогонов): панель 556,2 м²,
 * 792 самореза, 1229,86 п.м. шнура.
 *
 * ОТКРЫТЫЙ ВОПРОС: количество прогонов в исходнике вбито вручную
 * (ячейка I141 — просто число, 12 и 10 в двух проектах), а у нас оно
 * считается подбором прогонов. При другом подобранном шаге количество
 * саморезов разойдётся с расчётом расчётчика.
 */
export function computeRoofCladdingSection(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m" | "roofSlopeDeg">,
  roofArea_m2: number,
  panelThickness_mm: number,
  purlinLineCount: number,
): CladdingSectionTakeoff {
  const panel = estimateSandwichPanelCladding(roofArea_m2, panelThickness_mm, "roof");

  const screwCount = 2 * purlinLineCount * geometry.length_m * 1.1;
  const cordLength = geometry.length_m * rafterLengthPerFrame_m(geometry) * 1.1 * 2;

  return buildSection([
    {
      name: `СП ${panelThickness_mm} (кровля)`,
      count: roofArea_m2,
      unit: "м²",
      unitPrice: panel?.pricePerM2 ?? null,
      unitMass_kg: panel?.mass_kg != null && roofArea_m2 > 0 ? panel.mass_kg / roofArea_m2 : 0,
      cost: panel?.cost ?? null,
      mass_kg: panel?.mass_kg ?? 0,
    },
    simpleItem(ROOF_SCREW, screwCount, "шт"),
    simpleItem(SEALANT_CORD, cordLength, "п.м."),
  ]);
}
