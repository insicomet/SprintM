import settlementsRaw from "../../data/settlementsClimate.json";
import svMappingRaw from "../../data/svCodeMapping.json";
import type { SettlementClimate, SvCodeResult } from "./types";

interface SvCodeMappingFile {
  combo_to_standard: Record<string, string>;
  roman_to_digit: Record<string, string | number>;
}

const settlements = settlementsRaw as unknown as SettlementClimate[];
const svMapping = svMappingRaw as unknown as SvCodeMappingFile;

/** Ключ для нестрогого поиска: убрать края-пробелы, привести к нижнему регистру. */
function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

const settlementsByName = new Map<string, SettlementClimate>();
const settlementsByNormalizedName = new Map<string, SettlementClimate>();
for (const s of settlements) {
  settlementsByName.set(s.settlement, s);
  // При совпадении нормализованных ключей (разные города с одинаковым
  // написанием без учёта регистра/пробелов встречаются редко) оставляем
  // первое найденное — это тот же компромисс, что и в getAllSettlementNames.
  const normalized = normalizeKey(s.settlement);
  if (!settlementsByNormalizedName.has(normalized)) {
    settlementsByNormalizedName.set(normalized, s);
  }
}

/**
 * Найти населённый пункт по названию. Сначала точное совпадение (как в
 * источнике), иначе — без учёта регистра и краевых пробелов (частый
 * случай при ручном вводе или автозаполнении браузера: "иркутск",
 * "Иркутск " и т.п. должны находиться так же, как "Иркутск").
 */
export function findSettlement(name: string): SettlementClimate | undefined {
  return settlementsByName.get(name) ?? settlementsByNormalizedName.get(normalizeKey(name));
}

/** Список всех названий населённых пунктов — для автодополнения в UI. */
export function getAllSettlementNames(): readonly string[] {
  return settlements.map((s) => s.settlement);
}

/**
 * Перевести римский номер снегового/ветрового района ("I".."VIII", "Iа")
 * в цифровой код, используемый в банке сечений ИНСИ ("1".."8", "1а").
 */
export function romanDistrictToDigit(roman: string): string {
  const digit = svMapping.roman_to_digit[roman];
  if (digit === undefined) {
    throw new Error(`Неизвестный район "${roman}" — нет в таблице соответствия`);
  }
  return String(digit);
}

/**
 * Привести код "с/в" к одной из комбинаций, для которых в банке сечений
 * ИНСИ реально просчитаны данные (см. data/sv_code_mapping.json,
 * извлечено из листа "подбор" исходного файла, диапазон V19:W44).
 *
 * Не все комбинации там присутствуют (например "3/3" не встретилась
 * при извлечении банка сечений, хотя есть в таблице соответствия как
 * промежуточное значение "3/4") — это открытый вопрос, требует
 * проверки на дополнительных исходных данных.
 */
export function normalizeSvCode(rawCode: string): string {
  const standard = svMapping.combo_to_standard[rawCode];
  if (standard === undefined) {
    throw new Error(`Код "с/в" "${rawCode}" не найден в таблице соответствия`);
  }
  return standard;
}

/**
 * Определить код "с/в" по городу.
 *
 * ВАЖНО (открытое допущение): в исходном файле ИНСИ снеговой район
 * подбирается по РАЗНЫМ столбцам для уровня ответственности k=1,0 и
 * k=0,8 (лист "снегветер", столбцы J и L) — иногда они совпадают,
 * иногда нет. В settlementsClimate.json (источник — kilevoy/steel-building-calc)
 * хранится только один снеговой район на город, без разбивки по
 * ответственности. Пока используется он для обоих случаев;
 * это нужно перепроверить на дополнительных примерах из ИНСИ.
 */
export function computeSvCode(cityName: string): SvCodeResult {
  const city = findSettlement(cityName);
  if (!city) {
    throw new Error(`Город "${cityName}" не найден в справочнике климата`);
  }
  if (!city.snow.region || !city.wind.region) {
    throw new Error(`Для города "${cityName}" не заданы снеговой и/или ветровой район`);
  }

  const snowDigit = romanDistrictToDigit(city.snow.region);
  const windDigit = romanDistrictToDigit(city.wind.region);
  const raw = `${snowDigit}/${windDigit}`;
  const standard = normalizeSvCode(raw);

  return { city, raw, standard };
}
