import panelsRaw from "../../data/sandwichPanelPrices.json";
import type { CladdingEstimate, SandwichPanelOption } from "./types";

// В прайс-листе отсутствующая цена отмечена текстом "-"; приводим к null.
function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

const panels: SandwichPanelOption[] = (
  panelsRaw as {
    thickness_mm: number;
    wallPriceZLock: number | string;
    wallPriceSecretFix: number | string;
    roofPrice: number | string;
    weight_kg_m2: number | null;
  }[]
).map((p) => ({
  thickness_mm: p.thickness_mm,
  wallPriceZLock: numOrNull(p.wallPriceZLock),
  wallPriceSecretFix: numOrNull(p.wallPriceSecretFix),
  roofPrice: numOrNull(p.roofPrice),
  weight_kg_m2: p.weight_kg_m2,
}));

/** Доступные толщины трёхслойных сэндвич-панелей (минвата 105 кг/м³), мм. */
export function getSandwichPanelThicknesses(): readonly number[] {
  return panels.map((p) => p.thickness_mm);
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
): CladdingEstimate | null {
  const panel = panels.find((p) => p.thickness_mm === thickness_mm);
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
