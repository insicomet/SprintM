import rawCatalog from "../../data/facadePostCatalog.json";
import type { FacadePostProfile } from "./types";

interface RawRow {
  "№": string;
  "сталь": string;
  "Ry": string;
  "сечение": string;
  "вес_кг": string;
  "A_см2": string;
  "Wx_см3": string;
  "Wy_см3": string;
  "ix_см": string;
  "iy_см": string;
}

function toNum(v: string): number {
  return Number(v.replace(",", "."));
}

const catalog: FacadePostProfile[] = (rawCatalog as RawRow[])
  .filter((r) => r["сечение"] && r["Wx_см3"] !== "")
  .map((r) => ({
    section: r["сечение"],
    steelGrade: r["сталь"],
    Ry_MPa: toNum(r["Ry"]),
    mass_kg_per_m: toNum(r["вес_кг"]),
    area_cm2: toNum(r["A_см2"]),
    Wx_cm3: toNum(r["Wx_см3"]),
    Wy_cm3: toNum(r["Wy_см3"]),
    ix_cm: toNum(r["ix_см"]),
    iy_cm: toNum(r["iy_см"]),
  }))
  .sort((a, b) => a.mass_kg_per_m - b.mass_kg_per_m);

/** Каталог кандидатов сечений для стоек фахверка (квадратные/прямоугольные трубы), отсортирован по массе. */
export function getFacadePostCatalog(): readonly FacadePostProfile[] {
  return catalog;
}
