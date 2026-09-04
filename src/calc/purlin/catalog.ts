import catalog350Raw from "../../data/purlinCatalog350.json";
import catalog390Raw from "../../data/purlinCatalog390.json";
import type { PurlinProfile, PurlinSteelSeries } from "./types";

interface RawCatalogRow {
  "профиль": string;
  "пред_момент": string;
  "масса_1м_кг": string;
}

function familyOf(name: string): PurlinProfile["family"] | null {
  if (name.startsWith("2ТПС")) return "2ТПС";
  if (name.startsWith("2ПС")) return "2ПС";
  if (name.startsWith("Z ")) return "Z";
  return null;
}

function parseCatalog(rows: RawCatalogRow[], series: PurlinSteelSeries): PurlinProfile[] {
  const result: PurlinProfile[] = [];
  for (const row of rows) {
    const family = familyOf(row["профиль"]);
    // Извлечение с признаком строки-мусора на конце исходной таблицы
    // ("Толщина" — заголовок соседней таблицы, попавший в диапазон при
    // экспорте) — пропускаем строки, не начинающиеся с известного семейства.
    if (!family) continue;
    const limitMoment = Number(row["пред_момент"]);
    const mass = Number(row["масса_1м_кг"]);
    if (Number.isNaN(limitMoment) || Number.isNaN(mass)) continue;
    result.push({
      name: row["профиль"],
      family,
      series,
      limitMoment_kNm: limitMoment,
      mass_kg_per_m: mass,
    });
  }
  return result;
}

const catalog350 = parseCatalog(catalog350Raw as RawCatalogRow[], "МП350");
const catalog390 = parseCatalog(catalog390Raw as RawCatalogRow[], "МП390");

/** Полный каталог кандидатов прогонов (обе серии стали), отсортированный по массе. */
export function getPurlinCatalog(series?: PurlinSteelSeries): readonly PurlinProfile[] {
  const all = series === "МП350" ? catalog350 : series === "МП390" ? catalog390 : [...catalog350, ...catalog390];
  return [...all].sort((a, b) => a.mass_kg_per_m - b.mass_kg_per_m);
}
