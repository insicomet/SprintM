import type { BuildingGeometry } from "../geometry/types";
import { rafterLengthPerFrame_m } from "../geometry/frameGeometry";
import { estimateSandwichPanelCladding, type PanelMaterial } from "./sandwichPanel";
import { estimateProfnastilCladding } from "./profnastil";

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
 * Саморез крепления сэндвич-панели подбирается по её толщине:
 * **длина самореза = толщина панели + 40 мм**, округлённая до ближайшего
 * складского размера (правило подтверждено расчётчиком).
 *
 * В ведомости под это лежат две параллельные таблички (лист «12м»):
 * панели в M103:M109 — 80, 100, 150, 120, 200, 250 — и саморезы в
 * M110:M115 — 115, 140, 190, 160, 240, 285, в том же (перемешанном)
 * порядке. Расчётчик ставит в строку ссылку на нужную пару
 * (B103 = M111 стена, B139 = M112 кровля в «22316»).
 *
 * Ровно +40 получается на четырёх толщинах из шести; на краях такого
 * размера просто нет и берётся ближайший, на 5 мм короче: 80 → 115
 * (не 120) и 250 → 285 (не 290).
 *
 * Оба реальных проекта попадают в одну и ту же пару — стена 100 мм даёт
 * 5,5х140, кровля 150 мм даёт 5,5х190 — поэтому раньше эти две длины
 * стояли константами. На выдуманных расчётах с панелями 80/120/200 мм
 * это сразу вылезло: 140-миллиметровым саморезом 200-миллиметровую
 * панель не закрепить.
 *
 * Цены (N110:N115) взяты из кэша ведомости, а не из прайса, — как и во
 * всех остальных разделах, чтобы итог сходился с расчётом расчётчика.
 */
const PANEL_SCREW_BY_THICKNESS: Record<number, { name: string; unitPrice: number }> = {
  80: { name: "с/з 5,5х115", unitPrice: 43.1 },
  100: { name: "с/з 5,5х140", unitPrice: 51.9 },
  120: { name: "с/з 5,5х160", unitPrice: 71.1 },
  150: { name: "с/з 5,5х190", unitPrice: 94.8 },
  200: { name: "с/з 5,5х240", unitPrice: 145.7 },
  250: { name: "с/з 5,5х285", unitPrice: 188.9 },
};
/** Масса самореза — 0,005 кг во всех строках обеих ведомостей, от длины не зависит. */
const PANEL_SCREW_MASS_kg = 0.005;

function panelScrew(
  thickness_mm: number,
): { name: string; unitPrice: number | null; unitMass_kg: number } {
  const screw = PANEL_SCREW_BY_THICKNESS[thickness_mm];
  // Толщины вне таблицы: длину знаем по правилу «+40», а цену — нет.
  // Показываем прочерк, а не ноль, иначе раздел молча посчитается дешевле.
  return {
    name: screw?.name ?? `с/з 5,5х${thickness_mm + 40}`,
    unitPrice: screw?.unitPrice ?? null,
    unitMass_kg: PANEL_SCREW_MASS_kg,
  };
}
/** БК шнур — уплотнительный шнур; массы в исходнике нет, считаем нулевой. */
const SEALANT_CORD = { name: "БК шнур", unitPrice: 63.3, unitMass_kg: 0 };

/**
 * Саморез крепления профлиста — одна и та же позиция и цена что для
 * стены, что для кровли (лист «12м» реального файла «21604», строки
 * 106 и 137: обе ссылаются на цену из «Перекупные»!$F$49, 2,346 ₽/шт;
 * масса 0,0026 кг/шт — H106/H137 в том же файле).
 */
const PROFNASTIL_SCREW = { name: "Саморез 4,8x20", unitPrice: 2.3459999999999996, unitMass_kg: 0.0026 };

export function buildSection(items: CladdingItem[]): CladdingSectionTakeoff {
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
  spec: { name: string; unitPrice: number | null; unitMass_kg: number },
  count: number,
  unit: string,
): CladdingItem {
  return {
    name: spec.name,
    count,
    unit,
    unitPrice: spec.unitPrice,
    unitMass_kg: spec.unitMass_kg,
    cost: spec.unitPrice === null ? null : count * spec.unitPrice,
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
  material: PanelMaterial = "ТУ",
): CladdingSectionTakeoff {
  const panel = estimateSandwichPanelCladding(netWallArea_m2, panelThickness_mm, "wall", "zLock", material);

  const screwCount = (netWallArea_m2 / geometry.framePitch_m) * 6 * 1.1;
  const cordLength =
    Math.ceil(geometry.height_m - 1) * (geometry.span_m + geometry.length_m) * 2 * 2 * 1.1;

  return buildSection([
    {
      name: `СП ${panelThickness_mm} (стена, Z-lock${material === "ПИР" ? ", ПИР" : ""})`,
      count: netWallArea_m2,
      unit: "м²",
      unitPrice: panel?.pricePerM2 ?? null,
      unitMass_kg: panel?.mass_kg != null && netWallArea_m2 > 0 ? panel.mass_kg / netWallArea_m2 : 0,
      cost: panel?.cost ?? null,
      mass_kg: panel?.mass_kg ?? 0,
    },
    simpleItem(panelScrew(panelThickness_mm), screwCount, "шт"),
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
 * Количество прогонов в исходнике вбито вручную (ячейка I141 — просто
 * число, 12 и 10 в двух проектах), но это ровно то, что даёт подбор:
 * (ВВЕРХ(полупролёт / шаг) + 1) × скатов — см. computePurlinLayout().
 * Добавка под снегозадержание сюда НЕ входит, она есть только в
 * погонаже самих прогонов.
 */
/**
 * Раздел "Стена" для обшивки профлистом (С-18) вместо сэндвич-панели.
 *
 * Площадь — БРУТТО, без вычета проёмов (в отличие от СП): в реальном
 * файле «21604» строка листа (C41) и строка самореза (C106, "=10×C41")
 * обе считаются от той же формулы `computeProfnastilWallGrossArea_m2`
 * без вычитания ворот/дверей — площадь стены в ведомости (1129 м²)
 * сошлась именно с брутто-значением (1128,6 м²), не с нетто.
 *
 * Крепёж: саморез 4,8×20, количество = площадь × 10 — та же живая
 * формула C106 из «21604», не дормантная (×0) строка, как было раньше.
 */
export function computeProfnastilWallSection(
  grossWallArea_m2: number,
  thickness_mm: number,
): CladdingSectionTakeoff {
  const sheet = estimateProfnastilCladding(grossWallArea_m2, "С-18", thickness_mm);
  return buildSection([
    {
      name: `Профлист С-18 ${thickness_mm} (стена)`,
      count: grossWallArea_m2,
      unit: "м²",
      unitPrice: sheet?.pricePerM2 ?? null,
      unitMass_kg: sheet?.mass_kg != null && grossWallArea_m2 > 0 ? sheet.mass_kg / grossWallArea_m2 : 0,
      cost: sheet?.cost ?? null,
      mass_kg: sheet?.mass_kg ?? 0,
    },
    simpleItem(PROFNASTIL_SCREW, grossWallArea_m2 * 10, "шт"),
  ]);
}

/**
 * То же для кровли — марка С-44, живая формула C137 из «21604»
 * ("=(C77+C78)×8", C77 — внутренняя обшивка, всегда 0 при "нет"):
 * количество = площадь кровли × 8. См. computeProfnastilWallSection.
 */
export function computeProfnastilRoofSection(
  roofArea_m2: number,
  thickness_mm: number,
): CladdingSectionTakeoff {
  const sheet = estimateProfnastilCladding(roofArea_m2, "С-44", thickness_mm);
  return buildSection([
    {
      name: `Профлист С-44 ${thickness_mm} (кровля)`,
      count: roofArea_m2,
      unit: "м²",
      unitPrice: sheet?.pricePerM2 ?? null,
      unitMass_kg: sheet?.mass_kg != null && roofArea_m2 > 0 ? sheet.mass_kg / roofArea_m2 : 0,
      cost: sheet?.cost ?? null,
      mass_kg: sheet?.mass_kg ?? 0,
    },
    simpleItem(PROFNASTIL_SCREW, roofArea_m2 * 8, "шт"),
  ]);
}

export function computeRoofCladdingSection(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m" | "roofSlopeDeg">,
  roofArea_m2: number,
  panelThickness_mm: number,
  purlinLineCount: number,
  material: PanelMaterial = "ТУ",
): CladdingSectionTakeoff {
  const panel = estimateSandwichPanelCladding(roofArea_m2, panelThickness_mm, "roof", "zLock", material);

  const screwCount = 2 * purlinLineCount * geometry.length_m * 1.1;
  const cordLength = geometry.length_m * rafterLengthPerFrame_m(geometry) * 1.1 * 2;

  return buildSection([
    {
      name: `СП ${panelThickness_mm} (кровля${material === "ПИР" ? ", ПИР" : ""})`,
      count: roofArea_m2,
      unit: "м²",
      unitPrice: panel?.pricePerM2 ?? null,
      unitMass_kg: panel?.mass_kg != null && roofArea_m2 > 0 ? panel.mass_kg / roofArea_m2 : 0,
      cost: panel?.cost ?? null,
      mass_kg: panel?.mass_kg ?? 0,
    },
    simpleItem(panelScrew(panelThickness_mm), screwCount, "шт"),
    simpleItem(SEALANT_CORD, cordLength, "п.м."),
  ]);
}
