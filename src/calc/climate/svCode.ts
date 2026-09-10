import settlementsRaw from "../../data/settlementsClimate.json";
import svMappingRaw from "../../data/svCodeMapping.json";
import type { SettlementClimate, SvCode, SvCodeResult } from "./types";

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

/**
 * Старые (до 1997 года) русские названия городов, переименованных после
 * распада СССР, — многие до сих пор ищут именно по ним. В справочнике
 * город записан под нынешним официальным названием (как в таблице,
 * присланной расчётчиком), поэтому старое название не находилось вовсе.
 * Добавляется как отдельная, равноценная запись для поиска и
 * автодополнения — климатические данные не дублируются, это то же самое
 * значение под другим именем.
 */
const RENAMED_SETTLEMENTS: ReadonlyArray<readonly [current: string, historical: string]> = [
  ["Костанай", "Кустанай"],
];

function historicalAliasNames(s: SettlementClimate): string[] {
  const aliases: string[] = [];
  for (const [current, historical] of RENAMED_SETTLEMENTS) {
    if (s.settlement.startsWith(current)) {
      aliases.push(historical + s.settlement.slice(current.length));
    }
  }
  return aliases;
}

const byNormalizedName = new Map<string, SettlementClimate[]>();
const byNormalizedQualified = new Map<string, SettlementClimate>();
const aliasDisplayNames: string[] = [];
const byAliasKey = new Map<string, SettlementClimate>();
for (const s of settlements) {
  const key = normalizeKey(s.settlement);
  const bucket = byNormalizedName.get(key);
  if (bucket) bucket.push(s);
  else byNormalizedName.set(key, [s]);

  byNormalizedQualified.set(normalizeKey(qualifiedSettlementName(s)), s);

  for (const alias of historicalAliasNames(s)) {
    aliasDisplayNames.push(alias);
    byAliasKey.set(normalizeKey(alias), s);
  }
}

/**
 * Все населённые пункты с таким названием. Тёзки в справочнике есть
 * (например два Берёзовских — в Свердловской и Кемеровской областях, с
 * разным климатом), поэтому UI должен их различать.
 */
export function findSettlementsByName(name: string): readonly SettlementClimate[] {
  const qualified = byNormalizedQualified.get(normalizeKey(name));
  if (qualified) return [qualified];
  const byName = byNormalizedName.get(normalizeKey(name));
  if (byName) return byName;
  const alias = byAliasKey.get(normalizeKey(name));
  return alias ? [alias] : [];
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
 * выбрать осознанно. Плюс старые (дореформенные) названия — отдельными
 * строками, чтобы автодополнение реально показывало их при вводе, а не
 * только «понимало» через синоним под капотом.
 */
export function getAllSettlementNames(): readonly string[] {
  const names: string[] = [];
  for (const [, group] of byNormalizedName) {
    if (group.length === 1) names.push(group[0].settlement);
    else names.push(...group.map(qualifiedSettlementName));
  }
  names.push(...aliasDisplayNames);
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
 * ОСТОРОЖНО С ДУБЛЯМИ. В таблице исходника комбинация "3/3" встречается
 * ДВАЖДЫ: в основном блоке (строка 30) она ведёт на "3/2", и ещё раз
 * ниже блока (строка 39) — на "3/4". Формула подборщика
 * ПОИСКПОЗ(...;$V$19:$V$44;0) берёт ПЕРВОЕ совпадение, то есть "3/2";
 * блока "3/4" в банке сечений нет вовсе. Первая выгрузка взяла последнее
 * значение, и все города со снегом III и ветром III (Новосибирск и
 * другие) упирались в несуществующую комбинацию.
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

/**
 * То же, но без исключения: если сочетания в банке нет, берётся
 * ближайшее просчитанное, и об этом сообщается вызывающему.
 *
 * Так велел проектировщик по 47 непокрытым городам справочника: «считать
 * по ближайшей строке с пометкой „требует проверки“». Ближайшее ищется
 * сначала по снеговому району (он определяет сечения куда сильнее), потом
 * по ветровому; при равном расстоянии берётся БОЛЬШИЙ район, то есть
 * более тяжёлая сторона — приблизительный расчёт не должен оказаться
 * легче настоящего.
 *
 * Примеры: «6/2» (Норильск и компания) → 5/2 → блок 5/3;
 *          «3/5» (Черноморское побережье) → 3/3 → блок 3/2.
 */
export function normalizeSvCodeOrNearest(rawCode: SvCode): SvNormalization {
  const exact = svMapping.combo_to_standard[rawCode];
  if (exact !== undefined) return { standard: exact, nearest: null };

  const [snow, wind] = rawCode.split("/").map(districtValue);
  interface Candidate {
    code: SvCode;
    /** Ключ сравнения: чем меньше, тем ближе; последние два — «крупнее лучше». */
    rank: [number, number, number, number];
  }
  let best: Candidate | null = null;
  for (const code of Object.keys(svMapping.combo_to_standard)) {
    const [s, w] = code.split("/").map(districtValue);
    const candidate: Candidate = {
      code,
      rank: [Math.abs(s - snow), Math.abs(w - wind), -s, -w],
    };
    if (best === null || isCloser(candidate.rank, best.rank)) best = candidate;
  }
  if (best === null) throw new Error("Таблица сочетаний «с/в» пуста");

  return {
    standard: svMapping.combo_to_standard[best.code],
    nearest: { raw: rawCode, used: best.code },
  };
}

/** Лексикографическое сравнение ключей близости. */
function isCloser(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** Номер района как число: «1а» — это ступень ПЕРЕД «1», отсюда 0,5. */
function districtValue(digit: string): number {
  const base = Number.parseFloat(digit);
  if (Number.isNaN(base)) return 0;
  return /[аa]$/i.test(digit) ? base - 0.5 : base;
}

export interface SvNormalization {
  /** Блок банка, по которому пойдёт подбор. */
  standard: SvCode;
  /** null — сочетание есть в банке; иначе какое взяли вместо какого. */
  nearest: { raw: SvCode; used: SvCode } | null;
}

/** Все сочетания «с/в», для которых в банке ИНСИ есть просчитанные строки. */
export function getSupportedSvCodes(): readonly string[] {
  return [...new Set(Object.values(svMapping.combo_to_standard))].sort();
}

/**
 * Покрывает ли банк сечений климат этого населённого пункта ТОЧНО, без
 * округления до соседней строки.
 *
 * Из 1096 городов справочника точного сочетания нет у 44 (плюс три без
 * ветрового района): Камчатка, Сахалин, Курилы, Кольский полуостров,
 * Черноморское побережье. Расчёт для них теперь всё равно идёт — по
 * ближайшей строке с пометкой «требует проверки», см.
 * normalizeSvCodeOrNearest, — так что эта функция отвечает не «можно ли
 * считать», а «будет ли расчёт точным».
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

/**
 * Код «с/в» из явно заданных районов.
 *
 * Нужен, когда снеговой район берётся не из справочника напрямую, а через
 * лестницу нагрузок ИНСИ (см. climate/snowLadder.ts): ветровой район при
 * этом остаётся из справочника — у ИНСИ он тоже читается по СП, без
 * пересчёта (подбор!AK9 = снегветер, столбец H).
 */
export function svCodeFromDistricts(
  snowDistrict: string,
  windDistrict: string,
): { raw: SvCode; standard: SvCode } {
  const raw = `${romanDistrictToDigit(snowDistrict)}/${romanDistrictToDigit(windDistrict)}`;
  return { raw, standard: normalizeSvCode(raw) };
}

/**
 * То же, но с откатом на ближайшее сочетание банка (см.
 * normalizeSvCodeOrNearest) — для городов на краю таблицы.
 */
export function svCodeFromDistrictsOrNearest(
  snowDistrict: string,
  windDistrict: string,
): { raw: SvCode } & SvNormalization {
  const raw = `${romanDistrictToDigit(snowDistrict)}/${romanDistrictToDigit(windDistrict)}`;
  return { raw, ...normalizeSvCodeOrNearest(raw) };
}
