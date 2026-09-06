import tableRaw from "../../data/deckingSpanCapacity.json";

interface DeckingTableFile {
  "марки": string[];
  "строки": { "шаг_мм": number; "несущая_кПа": Record<string, number | null> }[];
}

const table = tableRaw as unknown as DeckingTableFile;

/** Марки настила, для которых в подборщике есть таблица несущей способности. */
export const DECKING_MARKS: readonly string[] = table["марки"];

/**
 * Марка настила, которую расчётчик ставил в обеих реальных ведомостях
 * (вывод!D21 — поле помечено "ВАЖНО!" и заполняется вручную).
 */
export const DEFAULT_DECKING_MARK = "С44-1000-0,7";

/**
 * Марка настила "по умолчанию" по типу покрытия (вывод!O5): для профлиста
 * и всех вариантов "нашей послойки" берётся С44-1000-0,7, для сэндвич-панели
 * — сама панель (её колонка в таблице называется "с-п 150" и т.п.).
 *
 * ВНИМАНИЕ: в обоих реальных проектах покрытие — "С-П 150", то есть по
 * этому правилу настилом была бы сама панель, но расчётчик вручную вписал
 * С44-1000-0,7 (вывод!D21), и максимальный шаг посчитан именно по нему.
 * Поэтому по умолчанию мы берём то, что реально делал расчётчик — см.
 * DEFAULT_DECKING_MARK.
 */
export function defaultDeckingMarkForRoofing(roofingType: string): string {
  if (roofingType === "профлист" || roofingType.startsWith("наше ")) return DEFAULT_DECKING_MARK;
  const asColumn = roofingType.toLowerCase();
  return DECKING_MARKS.some((m) => m.toLowerCase() === asColumn) ? asColumn : DEFAULT_DECKING_MARK;
}

/**
 * Максимальный шаг прогонов по несущей способности настила
 * (вывод!D23 = INDEX(W11:W63, MATCH(E23, X11:X63, -1))).
 *
 * В таблице для каждого шага указана несущая способность настила, кН/м²;
 * с ростом шага она падает. Берём самый крупный шаг, который ещё держит
 * заданную нагрузку.
 *
 * Нагрузка для сравнения — "нагрузка на покрытие" × 1,15 (вывод!E23), то
 * есть БЕЗ собственного веса покрытия: E23 = 'Подбор прогонов'!B13 × 1,15.
 */
export function maxPurlinStepByDecking(mark: string, load_kPa: number): number | null {
  const key = DECKING_MARKS.find((m) => m.toLowerCase() === mark.toLowerCase());
  if (!key) return null;

  let best: number | null = null;
  for (const row of table["строки"]) {
    const capacity = row["несущая_кПа"][key];
    if (capacity != null && capacity >= load_kPa) best = row["шаг_мм"];
  }
  return best;
}
