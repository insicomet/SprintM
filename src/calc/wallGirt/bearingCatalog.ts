import bearingRaw from "../../data/girtBearingCatalog.json";
import { findGirtProfile } from "./catalog";
import type { GirtProfileOption } from "./types";

/** Одна строка листа «несушки» «Калькулятор ограждайки v1.5.xlsx» (A1:U636). */
export interface GirtBearingRow {
  вид: string;
  тип_сечения: string;
  раскреп: boolean;
  толщина_мм: number;
  высота_профиля_мм: number;
  к_т_исп_по_умолчанию: number;
  материал: string;
  толщина_утепления_мм: number;
  профиль: string;
  пред_момент: number;
  масса_1м_профиля_кг: number;
  масса_1м_сечения_кг: number;
  масса_узловых_сборок_кг: number;
}

const BEARING_ROWS = bearingRaw as GirtBearingRow[];

/** Семейства, для которых есть цена в прайсе обвязки (ПГССигма/ТПГС — сечения рамы, сюда не относятся). */
const PRICED_FAMILIES = new Set(["ПП", "ПС", "ТПП", "ТПС"]);

/**
 * Спаренная схема сечения — тип «]» (одинарный профиль) против «][»/«[-]»/«[]»
 * (профиль сшит из двух половин); влияет на число рядов и вес кронштейна
 * (см. wallGirt.ts) и уже учтена в «Масса 1м сечения, кг» несушки.
 */
export function isPairedSection(row: Pick<GirtBearingRow, "тип_сечения">): boolean {
  return row.тип_сечения !== "]";
}

const PROFILE_NAME_RE = /^(ПП|ПС|ТПП|ТПС)\s*(\d+)[xх](\d+)[xх]?([\d,.]+)?$/;

/**
 * Профиль по прайсу (вес/цена — GirtProfileOption), соответствующий строке
 * несушки — по семейству/размеру/толщине, без учёта префикса типа сечения
 * (цены на сшитые сечения в прайсе нет в принципе). null — если семейство
 * не из числа обвязочных (например «ПГССигма» — сечение рамы) или размер
 * отсутствует в текущем прайсе.
 *
 * Масса погонного метра берётся из самой строки несушки («Масса 1м
 * сечения, кг»), а не пересчитывается умножением одинарного профиля на 2:
 * для схем «][»/«[]» это и даёт ровно ×2 (проверено на всех строках
 * каталога), но у «[-]» отношение переменное — от ×2,2 до ×2,7 в
 * зависимости от типоразмера, то есть это не просто спаренный профиль, а
 * другая (более тяжёлая) сборка. Цена масштабируется тем же
 * коэффициентом, что и масса — точной цены на сшитые сечения в прайсе нет.
 */
export function resolvePricedProfile(row: GirtBearingRow): GirtProfileOption | null {
  if (!PRICED_FAMILIES.has(row.вид)) return null;
  const rest = row.профиль.slice(row.тип_сечения.length);
  const match = PROFILE_NAME_RE.exec(rest);
  if (!match) return null;
  const [, family, height, width, thicknessRaw] = match;
  const thicknessStr =
    thicknessRaw != null && (thicknessRaw.includes(",") || thicknessRaw.includes("."))
      ? thicknessRaw.replace(".", ",")
      : `${thicknessRaw ?? row.толщина_мм},0`;
  const single = findGirtProfile(`${family} ${height}х${width}х${thicknessStr}`, false);
  if (!single) return null;
  if (!isPairedSection(row)) return single;

  const massRatio = row.масса_1м_сечения_кг / row.масса_1м_профиля_кг;
  return {
    ...single,
    name: `${row.тип_сечения}${single.name}`,
    weightPerMeter_kg: row.масса_1м_сечения_кг,
    pricePerMeter: single.pricePerMeter != null ? single.pricePerMeter * massRatio : null,
  };
}

/** Все строки несущей способности («несушки»), для которых есть цена в прайсе обвязки. */
export function getPricedGirtBearingRows(): readonly GirtBearingRow[] {
  return BEARING_ROWS.filter((r) => resolvePricedProfile(r) !== null);
}

export function getGirtBearingCatalog(): readonly GirtBearingRow[] {
  return BEARING_ROWS;
}
