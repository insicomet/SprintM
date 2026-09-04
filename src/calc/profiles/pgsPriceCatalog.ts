import pricesRaw from "../../data/framePGSPrices.json";
import type { PgsDimensions } from "./parseProfileName";

interface RawPriceRow {
  name: string;
  code: number | null;
  group: string | null;
  price0: number | null;
  unit: string | null;
  weight_kg: number | null;
  pricePerTon: number | null;
  priceSale: number | null;
}

interface FramePriceFile {
  "ПГС и ТПГС": RawPriceRow[];
}

const prices = pricesRaw as unknown as FramePriceFile;

// "ПГС-сигма 300х80x20 без перфор. 1,2 (Оцинк.)" / "...1,5 П350 (Колор-поток с двух сторон)"
//
// ВАЖНО: это отдельное семейство от простого "ПГС 300х80 без перфор. ..."
// (без "-сигма" и без завершающего "x20") — та, короткая линейка не
// покрывает все толщины (например для 300х80 у неё нет 3,0мм), а банк
// сечений использует именно сигма-профиль ("ПГС300/20х80х...", где "/20"
// — тот же типоразмер полки, что в прайсе записан как "x20"). Смешение
// этих двух семейств — реальная ошибка, которая была здесь до правки:
// сверка с прайс-листом (см. issue от 2026-09-04) показала, что нужная
// строка "ПГС-сигма 300х80x20 без перфор. 3,0 П350 (Оцинк.)" в прайсе
// есть, просто была не той веткой регулярки.
const PRICE_NAME_RE = /^ПГС-сигма (\d+)[xх](\d+)[xх]20 без перфор\. ([\d,]+)(?:\s+П\d+)?\s*\(([^)]+)\)$/;

export interface PgsProfileProperties {
  name: string;
  /** Масса погонного метра, кг/м. */
  massPerM_kg: number;
  /** Цена продажи за метр (со стандартной наценкой +5%), ₽/п.м. */
  priceSale_perM: number | null;
  coating: string;
}

interface ParsedPriceEntry extends PgsDimensions {
  coating: string;
  row: RawPriceRow;
}

const parsedCatalog: ParsedPriceEntry[] = [];
for (const row of prices["ПГС и ТПГС"]) {
  const match = PRICE_NAME_RE.exec(row.name);
  if (!match) continue;
  parsedCatalog.push({
    h_mm: Number(match[1]),
    b_mm: Number(match[2]),
    t_mm: Number(match[3].replace(",", ".")),
    coating: match[4],
    row,
  });
}

/**
 * Найти свойства (масса, цена) профиля ПГС по размерам сечения и толщине.
 *
 * По умолчанию ищет оцинкованный вариант ("Оцинк.") — он используется как
 * базовый несущий профиль каркаса независимо от отделки фасада.
 * Если оцинкованного варианта для данной толщины нет в прайсе, но есть
 * другое покрытие — возвращает его вместо null (лучше приблизительная
 * масса, чем отсутствие результата), результат помечает поле coating.
 */
export function findPgsProperties(
  dims: PgsDimensions,
  preferredCoating: string = "Оцинк.",
): PgsProfileProperties | null {
  const candidates = parsedCatalog.filter(
    (p) => p.h_mm === dims.h_mm && p.b_mm === dims.b_mm && p.t_mm === dims.t_mm,
  );
  if (candidates.length === 0) return null;

  const preferred = candidates.find((p) => p.coating === preferredCoating) ?? candidates[0];

  return {
    name: preferred.row.name,
    massPerM_kg: preferred.row.weight_kg ?? NaN,
    priceSale_perM: preferred.row.priceSale,
    coating: preferred.coating,
  };
}
