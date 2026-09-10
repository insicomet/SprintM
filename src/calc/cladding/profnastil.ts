import pricesRaw from "../../data/profnastilPrices.json";
import type { CladdingEstimate } from "./types";

interface RawProfnastilRow {
  "марка": string;
  "толщина_мм": number;
  "покрытие": string;
  "цена_за_м2": number;
  "вес_кг_м2": number;
}

const rows = (pricesRaw as { "марки": RawProfnastilRow[] })["марки"];

/** Толщины, доступные для марки профлиста (обычно 0,5 и 0,7 мм). */
export function getProfnastilThicknesses(mark: string): readonly number[] {
  return [...new Set(rows.filter((r) => r["марка"] === mark).map((r) => r["толщина_мм"]))].sort(
    (a, b) => a - b,
  );
}

/**
 * Цена и масса листа профлиста по прайсу ИНСИ (лист «Профлист,доборы»).
 *
 * По умолчанию — окрашенный («полимер»), как в обоих присланных примерах
 * (стены С-18, кровля С-44). Площадь — уже готовая (за вычетом проёмов
 * для стен), без наценки на нахлёст: она заложена в саму формулу площади
 * (computeProfnastilWallGrossArea_m2 / computeProfnastilRoofArea_m2).
 */
export function estimateProfnastilCladding(
  area_m2: number,
  mark: string,
  thickness_mm: number,
  coating: "окр." | "оцинк." = "окр.",
): CladdingEstimate | null {
  const row = rows.find(
    (r) => r["марка"] === mark && r["толщина_мм"] === thickness_mm && r["покрытие"] === coating,
  );
  if (!row) return null;
  return {
    area_m2,
    thickness_mm,
    pricePerM2: row["цена_за_м2"],
    cost: row["цена_за_м2"] * area_m2,
    mass_kg: row["вес_кг_м2"] * area_m2,
  };
}
