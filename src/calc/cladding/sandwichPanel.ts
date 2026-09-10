import panelsRawTU from "../../data/sandwichPanelPrices.json";
import panelsRawPIR from "../../data/sandwichPanelPricesPIR.json";
import type { CladdingEstimate, SandwichPanelOption } from "./types";

// В прайс-листе отсутствующая цена отмечена текстом "-"; приводим к null.
function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function parsePanels(
  raw: {
    thickness_mm: number;
    wallPriceZLock: number | string;
    wallPriceSecretFix: number | string;
    roofPrice: number | string;
    weight_kg_m2: number | null;
  }[],
): SandwichPanelOption[] {
  return raw.map((p) => ({
    thickness_mm: p.thickness_mm,
    wallPriceZLock: numOrNull(p.wallPriceZLock),
    wallPriceSecretFix: numOrNull(p.wallPriceSecretFix),
    roofPrice: numOrNull(p.roofPrice),
    weight_kg_m2: p.weight_kg_m2,
  }));
}

export type PanelMaterial = "ТУ" | "ПИР";

/**
 * Доступные толщины трёхслойных сэндвич-панелей, мм — по умолчанию из
 * блока "ТУ" прайс-листа (минвата 95 кг/м³). Над ним в исходном файле
 * стоит пометка "Эти применяем в стандартном расчете !", и обе реальные
 * ведомости ссылаются именно на него ([2]СП!$I$11 = 2740 ₽/м² для СП 100,
 * масса 20,1 кг/м²). Второй минватный блок, "ГОСТ" (105 кг/м³, СП 100 =
 * 2930 ₽/м²), в расчёте не используется.
 *
 * У толщины 50мм в блоке ТУ цен нет — там прочерки, поэтому она
 * доступна в списке, но без цены.
 */
const panelsByMaterial: Record<PanelMaterial, SandwichPanelOption[]> = {
  ТУ: parsePanels(panelsRawTU),
  // "ПИР" (полиизоцианурат) — второй материал панели, реально встречается
  // в расчётах («21550») как выбор заказчика по ТЗ (расчётчик: «Это выбор
  // заказчика по ТЗ»), не редкое исключение. Цены — блок "ПИР" (плотность
  // 41 кг/м³, не "ПИР (ППИ L)" 38 кг/м³ — «21550» ссылается формулой
  // именно на первый, [2]СП!$C$29). У этого блока в прайс-листе нет
  // столбца массы вовсе (только у "ППИ L" он частично есть, для двух
  // толщин) — поэтому масса ПИР-панели пока не считается (null), только
  // цена; в весе здания панель не участвует, что отражено явно.
  ПИР: parsePanels(panelsRawPIR),
};

export function getSandwichPanelThicknesses(material: PanelMaterial = "ТУ"): readonly number[] {
  return panelsByMaterial[material].map((p) => p.thickness_mm);
}

export type WallFixing = "zLock" | "secretFix";

function pricePerM2(panel: SandwichPanelOption, use: "wall" | "roof", fixing: WallFixing): number | null {
  if (use === "roof") return panel.roofPrice;
  return fixing === "zLock" ? panel.wallPriceZLock : panel.wallPriceSecretFix;
}

export function estimateSandwichPanelCladding(
  area_m2: number,
  thickness_mm: number,
  use: "wall" | "roof",
  fixing: WallFixing = "zLock",
  material: PanelMaterial = "ТУ",
): CladdingEstimate | null {
  const panel = panelsByMaterial[material].find((p) => p.thickness_mm === thickness_mm);
  if (!panel) return null;

  const price = pricePerM2(panel, use, fixing);
  return {
    area_m2,
    thickness_mm,
    pricePerM2: price,
    cost: price !== null ? price * area_m2 : null,
    mass_kg: panel.weight_kg_m2 !== null ? panel.weight_kg_m2 * area_m2 : null,
  };
}
