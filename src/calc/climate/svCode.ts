import settlementsRaw from "../../data/settlementsClimate.json";
import svMappingRaw from "../../data/svCodeMapping.json";
import type { SettlementClimate, SvCodeResult } from "./types";

interface SvCodeMappingFile {
  combo_to_standard: Record<string, string>;
  roman_to_digit: Record<string, string | number>;
}

const settlements = settlementsRaw as unknown as SettlementClimate[];
const svMapping = svMappingRaw as unknown as SvCodeMappingFile;

/**
 * Ключ для нестрогого поиска: убрать края-пробелы, привести к нижнему
 * регистру и приравнять "ё" к "е".
 *
 * Последнее существенно: в справочнике город записан как "Берёзовский",
 * а в исходных файлах ИНСИ и при ручном вводе — "Березовский". Без
 * этого приведения такой город просто не находился.
 */
function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е");
}

/** "Город, Регион" — форма для различения одноимённых населённых пунктов. */
export function qualifiedSettlementName(s: SettlementClimate): string {
  return `${s.settlement}, ${s.region}`;
}

const byNormalizedName = new Map<string, SettlementClimate[]>();
const byNormalizedQualified = new Map<string, SettlementClimate>();
for (const s of settlements) {
  const key = normalizeKey(s.settlement);
  const bucket = byNormalizedName.get(key);
  if (bucket) bucket.push(s);
  else byNormalizedName.set(key, [s]);

  byNormalizedQualified.set(normalizeKey(qualifiedSettlementName(s)), s);
}

/**
 * Все населённые пункты с таким названием. Тёзки в справочнике есть
 * (например два Берёзовских — в Свердловской и Кемеровской областях, с
 * разным климатом), поэтому UI должен их различать.
 */
export function findSettlementsByName(name: string): readonly SettlementClimate[] {
  const qualified = byNormalizedQualified.get(normalizeKey(name));
  if (qualified) return [qualified];
  return byNormalizedName.get(normalizeKey(name)) ?? [];
}

/**
 * Найти населённый пункт по названию — принимает как простое название
 * ("Иркутск", "иркутск", "Иркутск "), так и уточнённое "Город, Регион".
 * Если тёзок несколько и регион не указан, возвращает первый по порядку
 * справочника (UI показывает регион выбранного и предлагает уточнить).
 */
export function findSettlement(name: string): SettlementClimate | undefined {
  return findSettlementsByName(name)[0];
}

/**
 * Названия для автодополнения в UI: уникальные названия как есть, а
 * тёзки — в уточнённой форме "Город, Регион", чтобы их можно было
 * выбрать осознанно.
 */
export function getAllSettlementNames(): readonly string[] {
  const names: string[] = [];
  for (const [, group] of byNormalizedName) {
    if (group.length === 1) names.push(group[0].settlement);
    else names.push(...group.map(qualifiedSettlementName));
  }
  return names.sort((a, b) => a.localeCompare(b, "ru"));
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
    const [snow, wind] = rawCode.split("/");
    throw new Error(
      `Сочетание «снег ${snow} / ветер ${wind}» выходит за пределы банка сечений ИНСИ. ` +
        `Банк просчитан до снегового района V и ветрового IV; для этого города ` +
        `нужен индивидуальный расчёт.`,
    );
  }
  return standard;
}

/** Все сочетания «с/в», для которых в банке ИНСИ есть просчитанные строки. */
export function getSupportedSvCodes(): readonly string[] {
  return [...new Set(Object.values(svMapping.combo_to_standard))].sort();
}

/**
 * Покрывает ли банк сечений климат этого населённого пункта.
 *
 * По нашему справочнику (1096 городов) не покрыто 63: Камчатка, Сахалин,
 * Норильск, Воркута, Черноморское побережье и ещё несколько мест, где
 * сочетание снега и ветра выходит за просчитанную ИНСИ область.
 */
export function isSettlementSupported(cityName: string): boolean {
  try {
    computeSvCode(cityName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Определить код "с/в" по городу.
 *
 * РАСХОЖДЕНИЕ С ИСХОДНИКОМ ИНСИ (осознанное решение заказчика — наш
 * справочник в приоритете):
 *
 * Сами нагрузки у нас и у ИНСИ практически одни и те же: по 254 общим
 * городам снеговая нагрузка совпадает с их столбцом "по данным ГМЦ"
 * (снегветер!E) в 86% случаев, ветровая (снегветер!I) — тоже в 86%.
 *
 * А вот РАЙОН выводится по-разному. Мы берём его прямо из справочника
 * по СП 20.13330. ИНСИ же прогоняет нагрузку через собственную таблицу
 * порогов (снегветер!AB:AH), причём отдельную для каждого уровня
 * ответственности: столбец J при k=1,0 и столбец L при k=0,8. Из-за
 * этого одна и та же нагрузка может дать разные районы — например
 * Берёзовский при 1,5 кН/м² попадает у них в IV при k=1,0 и в III при
 * k=0,8, а у нас всегда III.
 *
 * Следствие: по части городов код "с/в" (а значит и подобранные
 * сечения) будет отличаться от расчёта ИНСИ. Уровень ответственности у
 * нас влияет только на выбор строки банка сечений, но не на район.
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
