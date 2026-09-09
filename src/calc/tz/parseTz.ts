import { SPANS, type ResponsibilityLevel, type Span } from "../../types/common";

/**
 * Разбор технического задания ИНСИ.
 *
 * ТЗ приходит менеджеру одним PDF по неизменному шаблону: пронумерованные
 * пункты 1…19, у каждого подпись и значение. Из него нужны только
 * габариты, город, утепление, проёмы, уровень ответственности и пометки
 * про водосток со снегозадержанием — остальное на расчёт не влияет.
 *
 * Разбор нарочно нестрогий: в текстовом слое PDF подпись и значение
 * иногда оказываются на одной строке, иногда на соседних, а порядок
 * внутри пункта плавает. Поэтому ищем по ключевым словам и берём первое
 * подходящее число или слово следом. Всё, что не удалось прочитать,
 * возвращается списком в `unread`, а не подставляется молча.
 */

export interface TzOpening {
  /** Ширина, м. */
  width_m: number;
  /** Высота, м. */
  height_m: number;
  count: number;
  /**
   * Ворота на длинной (продольной) стене раздвигают свою раму — см.
   * onLongWall в calc/geometry/openings.ts. Не имеет смысла для дверей
   * и окон, поэтому заполняется только у ворот.
   */
  onLongWall?: boolean;
}

export interface ParsedTz {
  /** Номер расчёта из шапки, если нашёлся. */
  number?: string;
  /** Название объекта. */
  title?: string;
  city?: string;
  /** Ширина здания из ТЗ, м — может не совпадать со стандартным пролётом. */
  width_m?: number;
  /** Ближайший стандартный пролёт, не меньше ширины. */
  span?: Span;
  length_m?: number;
  height_m?: number;
  gammaN?: ResponsibilityLevel;
  wallInsulation_mm?: number;
  roofInsulation_mm?: number;
  gates: TzOpening[];
  doors: TzOpening[];
  windows: TzOpening[];
  /** Организованный водосток и снегозадержание (пункт 14). */
  drainageAndSnowGuards?: boolean;
  /** Пункты, которые прочитать не удалось. */
  unread: string[];
  /** На что стоит посмотреть глазами: пункт 15 и прочие оговорки. */
  notes: string[];
}

/** Нормализуем текст: единый пробел, латинские «x» в русское «х». */
function normalize(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/[xX×]/g, "х")
    .replace(/[ \t]+/g, " ");
}

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Значение пункта: первое число после подписи, хоть на той же строке,
 * хоть на следующих. `within` ограничивает, как далеко смотреть.
 */
function numberAfter(lines: string[], label: RegExp, within = 3): number | null {
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].search(label);
    if (at < 0) continue;
    const tail = lines[i].slice(at).replace(label, "");
    const here = tail.match(/-?\d+(?:[.,]\d+)?/);
    if (here) return toNumber(here[0]);
    for (let j = i + 1; j <= i + within && j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next) continue;
      const m = next.match(/^-?\d+(?:[.,]\d+)?$/);
      if (m) return toNumber(m[0]);
      // Строка со следующей подписью — значит у этого пункта значения нет.
      if (/[А-Яа-я]{4}/.test(next)) break;
    }
  }
  return null;
}

/**
 * Значение пункта текстом.
 *
 * Между подписью и значением может стоять её продолжение — в шаблоне
 * подписи длинные и переносятся: «Место строительства (область, город,»
 * / «район):» / «Увильды». Такие строки пропускаем: значением считается
 * первая строка, которая не выглядит продолжением подписи. Условие можно
 * ужесточить через `accept`, когда известно, чего ждём.
 */
function isLabelContinuation(line: string): boolean {
  return /[:,]$/.test(line) || /^[а-яё(]/.test(line);
}

function textAfter(
  lines: string[],
  label: RegExp,
  options: { within?: number; accept?: (line: string) => boolean } = {},
): string | null {
  const within = options.within ?? 3;
  const accept = options.accept ?? ((l: string) => !isLabelContinuation(l));
  for (let i = 0; i < lines.length; i++) {
    const at = lines[i].search(label);
    if (at < 0) continue;
    const tail = lines[i].slice(at).replace(label, "").replace(/^[\s:,.-]+/, "").trim();
    if (tail && accept(tail)) return tail;
    for (let j = i + 1; j <= i + within && j < lines.length; j++) {
      const next = lines[j].trim();
      if (next && accept(next)) return next;
    }
  }
  return null;
}

/**
 * Строка проёмов вида «1х3м - 2 шт, 1х3,5 - 1 шт, 1х6м - 2 шт» — а
 * иногда, как в «22330», количество стоит ПЕРЕД размером: «2 шт 4х4».
 * Оба порядка встречаются в реальных ТЗ, поэтому ищем «N шт» и до, и
 * после размера.
 *
 * В ТЗ размер пишется «высота х ширина»: двери «1х2,1м» — это метр в
 * ширину и 2,1 в высоту, ворота «2,5х2,5» — квадратные. Значит первое
 * число ширина, второе высота; для окон получается «3х1», «6х1» —
 * ленточные, что и подтверждают реальные проекты.
 */
export function parseOpeningsLine(line: string): TzOpening[] {
  const out: TzOpening[] = [];
  const re =
    /(?:(\d+)\s*шт\s+)?(\d+(?:[.,]\d+)?)\s*х\s*(\d+(?:[.,]\d+)?)\s*м?\s*(?:-\s*(\d+)\s*шт)?/g;
  for (const m of normalize(line).matchAll(re)) {
    const width_m = toNumber(m[2]);
    const height_m = toNumber(m[3]);
    if (width_m === null || height_m === null) continue;
    const count = m[4] ?? m[1];
    out.push({ width_m, height_m, count: count ? Number(count) : 1 });
  }
  return out;
}

/** Ближайший стандартный пролёт, не меньше ширины здания. */
export function spanForWidth(width_m: number): Span | undefined {
  return SPANS.find((s) => s >= width_m);
}


/** Строки пункта — от подписи `from` до подписи следующего пункта `until`. */
function blockOf(lines: string[], from: RegExp, until: RegExp): string {
  const start = lines.findIndex((l) => from.test(l));
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (until.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join(" ");
}

/**
 * Проёмы пункта 10.
 *
 * В текстовом слое PDF подписи и значения этого пункта перемешаны:
 * размеры дверей стоят ВЫШЕ подписи «Двери:», а ворота — на одной строке
 * со своей. Поэтому берём весь блок пункта, собираем строки с размерами
 * и раздаём их: ворота — по строке со своей подписью, окна — по строке
 * сразу за «Окна:», дверям достаётся то, что осталось.
 */
function parseOpeningsBlock(lines: string[]): Pick<ParsedTz, "gates" | "doors" | "windows"> {
  const start = lines.findIndex((l) => /Наличие, тип и количество окон/i.test(l));
  const out: Pick<ParsedTz, "gates" | "doors" | "windows"> = { gates: [], doors: [], windows: [] };
  if (start < 0) return out;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/Наличие, тип и цвет обшивки/i.test(lines[i])) { end = i; break; }
  }
  const block = lines.slice(start, end);
  const claimed = new Set<number>();

  const sized = (i: number) => parseOpeningsLine(block[i]).length > 0;

  // Ворота — на строке со своей подписью. Стена (длинная/торец), если
  // упомянута в той же строке, — общая пометка для всех ворот на ней.
  const gateAt = block.findIndex((l, i) => /Ворота/i.test(l) && sized(i));
  if (gateAt >= 0) {
    const onLongWall = /продольн|длинн(?:ой|ая)\s+сторон|длинн(?:ой|ая)\s+стен/i.test(block[gateAt])
      ? true
      : /торц|фронтон|коротк(?:ой|ая)\s+стен/i.test(block[gateAt])
        ? false
        : undefined;
    out.gates = parseOpeningsLine(block[gateAt]).map((g) => ({ ...g, onLongWall }));
    claimed.add(gateAt);
  }

  // Окна — на строке с подписью либо на ближайшей следующей.
  const windowLabel = block.findIndex((l) => /Окна/i.test(l));
  if (windowLabel >= 0) {
    for (let i = windowLabel; i < Math.min(windowLabel + 3, block.length); i++) {
      if (!claimed.has(i) && sized(i)) {
        out.windows = parseOpeningsLine(block[i]); claimed.add(i); break;
      }
    }
  }

  // Дверям — всё оставшееся с размерами.
  for (let i = 0; i < block.length; i++) {
    if (claimed.has(i) || !sized(i)) continue;
    out.doors.push(...parseOpeningsLine(block[i]));
    claimed.add(i);
  }
  return out;
}

export function parseTz(text: string): ParsedTz {
  const lines = normalize(text).split(/\r?\n/);
  const joined = lines.join("\n");
  const result: ParsedTz = { gates: [], doors: [], windows: [], unread: [], notes: [] };

  result.number = joined.match(/Расчет\s*№\s*(\d+)/i)?.[1];
  result.title = blockOf(lines, /Название объекта/i, /Наименование здания/i)
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/Название объекта/i, "")
    .replace(/\s+/g, " ")
    .trim() || undefined;
  // В шаблоне подпись пункта 4 и значение стоят на одной строке:
  // «Место строительства (область, город, Увильды», а «район):» — ниже.
  // pdftotext кладёт город на строку подписи, pdf.js — через строку после
  // её продолжения «район):». Годятся оба.
  result.city =
    joined.match(/Место строительства[^\n]*?,\s*([А-ЯЁ][^\n,]*?)\s*$/m)?.[1].trim() ||
    (textAfter(lines, /Место строительства/i, {
      within: 4,
      accept: (l) => /^[А-ЯЁ]/.test(l) && !/^(район|область|город)/i.test(l),
    }) ??
      undefined);

  result.width_m = numberAfter(lines, /Ширина/i) ?? undefined;
  result.length_m = numberAfter(lines, /Длина/i) ?? undefined;
  result.height_m = numberAfter(lines, /Высота до низа несущих/i) ?? undefined;
  if (result.width_m !== undefined) result.span = spanForWidth(result.width_m);

  result.wallInsulation_mm = numberAfter(lines, /Утепление стен/i) ?? undefined;
  result.roofInsulation_mm = numberAfter(lines, /Утепление кровли/i) ?? undefined;

  Object.assign(result, parseOpeningsBlock(lines));

  // Пункт 19 записан как «/ 2 / нет»: посередине уровень ответственности.
  const responsibility = joined.match(/Уровень ответственности[\s\S]{0,120}?\/\s*(\d)\s*\//)?.[1];
  if (responsibility === "3") result.gammaN = 0.8;
  else if (responsibility === "1" || responsibility === "2") result.gammaN = 1.0;

  const drainage = textAfter(lines, /Наличие организованного водостока/i, {
    within: 3,
    accept: (l) => /^(да|нет)/i.test(l),
  });
  if (drainage) result.drainageAndSnowGuards = /^да/i.test(drainage.trim());

  // Что не прочиталось — говорим прямо, а не подставляем умолчание.
  const required: [keyof ParsedTz, string][] = [
    ["city", "место строительства"],
    ["width_m", "ширина здания"],
    ["length_m", "длина здания"],
    ["height_m", "высота до низа несущих"],
    ["wallInsulation_mm", "утепление стен"],
    ["roofInsulation_mm", "утепление кровли"],
  ];
  for (const [key, label] of required) if (result[key] === undefined) result.unread.push(label);
  if (result.width_m !== undefined && result.span === undefined) {
    result.unread.push(`ширина ${result.width_m} м больше самого широкого пролёта`);
  }

  if (result.span !== undefined && result.width_m !== undefined && result.span !== result.width_m) {
    result.notes.push(
      `Ширина по ТЗ ${result.width_m} м — считаем по ближайшему пролёту ${result.span} м`,
    );
  }
  const extra = joined.match(/Дополнительные требования[^\n]*\n([\s\S]*?)(?=\n\s*16\.)/i)?.[1];
  if (extra?.trim()) result.notes.push(extra.replace(/\s+/g, " ").trim());

  return result;
}
