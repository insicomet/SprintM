import catalog350Raw from "../../data/purlinCatalog350.json";
import catalog390Raw from "../../data/purlinCatalog390.json";
import type { PurlinFamily, PurlinProfile, PurlinSteelSeries } from "./types";

interface RawCatalogRow {
  "профиль": string;
  "пред_момент": number;
  "масса_1м_кг": number;
  "высота_послойки_мм": number | null;
}

function familyOf(name: string): PurlinFamily | null {
  if (name.startsWith("2ТПС")) return "2ТПС";
  if (name.startsWith("2ПС")) return "2ПС";
  if (name.startsWith("Z ")) return "Z";
  return null;
}

function parseCatalog(rows: RawCatalogRow[], series: PurlinSteelSeries): PurlinProfile[] {
  const result: PurlinProfile[] = [];
  for (const row of rows) {
    const family = familyOf(row["профиль"]);
    if (!family) continue;
    result.push({
      name: row["профиль"],
      family,
      series,
      limitMoment_kNm: row["пред_момент"],
      mass_kg_per_m: row["масса_1м_кг"],
      insulationThickness_mm: row["высота_послойки_мм"],
    });
  }
  return result;
}

const catalog350 = parseCatalog(catalog350Raw as RawCatalogRow[], "МП350");
const catalog390 = parseCatalog(catalog390Raw as RawCatalogRow[], "МП390");

/**
 * Банк прогонов одной серии стали — В ПОРЯДКЕ ИСХОДНИКА.
 *
 * Порядок существенный: при равной массе исходник берёт первый профиль
 * по порядку строк листа (MATCH по несортированному диапазону), поэтому
 * сортировать здесь нельзя.
 */
export function getPurlinCatalog(series: PurlinSteelSeries): readonly PurlinProfile[] {
  return series === "МП350" ? catalog350 : catalog390;
}

export const PURLIN_SERIES: readonly PurlinSteelSeries[] = ["МП350", "МП390"];
