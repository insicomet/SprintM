import rawBank from "../../data/sectionBank.json";
import type { ResponsibilityLevel, Span } from "../../types/common";
import { HEIGHT_BUCKETS_24, HEIGHT_BUCKETS_9_21, type FrameSelection } from "./types";

/** Сырая строка sectionBank.json — все поля приходят строками из CSV. */
interface RawBankRow {
  "пролет": string;
  "k": string;
  "Высота, м": string;
  "вариант": string;
  "шаг рам,м": string;
  "с/в": string;
  "колонна": string;
  "коэф исп.%": string;
  "балка": string;
  "коэф исп.%_6": string;
  "прогоны": string;
  "коэф исп.%_8": string;
  "балки конек": string;
  "балки карниз": string;
  "кололнна опора": string;
  "колонна карниз": string;
  "Болты в раме": string;
  "металлоемкость оциноковка, кг": string;
  "металлоемкость узловых пластин, кг": string;
}

function parseSpan(raw: string): Span {
  const n = Number(raw.replace("м", ""));
  return n as Span;
}

function toNumberOrNull(raw: string): number | null {
  if (raw === "" || raw === undefined) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function mapRow(row: RawBankRow): FrameSelection {
  const purlinRaw = row["прогоны"];
  return {
    span: parseSpan(row["пролет"]),
    responsibility: Number(row["k"]) as ResponsibilityLevel,
    heightBucket: Number(row["Высота, м"]),
    variant: row["вариант"],
    svCode: row["с/в"],
    framePitch_m: Number(row["шаг рам,м"]),
    column: {
      profile: row["колонна"],
      utilizationPercent: Number(row["коэф исп.%"]),
    },
    beam: {
      profile: row["балка"],
      utilizationPercent: Number(row["коэф исп.%_6"]),
    },
    purlin:
      purlinRaw === "" || purlinRaw === undefined
        ? null
        : { profile: purlinRaw, utilizationPercent: Number(row["коэф исп.%_8"]) },
    bolts: {
      beamRidge: row["балки конек"],
      beamEave: row["балки карниз"],
      columnBase: row["кололнна опора"],
      columnEave: row["колонна карниз"],
      totalInFrame: Number(row["Болты в раме"]),
    },
    massZinc_kg: toNumberOrNull(row["металлоемкость оциноковка, кг"]),
    massGussetPlates_kg: toNumberOrNull(row["металлоемкость узловых пластин, кг"]),
  };
}

const bank: FrameSelection[] = (rawBank as RawBankRow[]).map(mapRow);

/**
 * Привести фактическую высоту здания к ближайшей (не меньшей) "высотной
 * корзине" банка сечений, как это делает исходный файл ИНСИ (формулы
 * подбор!AM9..AM15 / AN9..AN15 — снаппинг вверх по списку доступных высот).
 *
 * Если высота больше максимальной доступной корзины — бросает ошибку
 * (в исходном файле такие случаи отмечены как "нужен расчет").
 */
export function snapHeight(span: Span, height_m: number): number {
  const buckets = span === 24 ? HEIGHT_BUCKETS_24 : HEIGHT_BUCKETS_9_21;
  const snapped = buckets.find((b) => height_m <= b);
  if (snapped === undefined) {
    throw new Error(
      `Высота ${height_m}м для пролёта ${span}м превышает максимальную корзину банка сечений ` +
        `(${buckets[buckets.length - 1]}м) — в исходном файле ИНСИ такой случай помечен "нужен расчет".`,
    );
  }
  return snapped;
}

export interface FrameSelectionQuery {
  span: Span;
  /** Фактическая высота здания, м — будет приведена к ближайшей корзине через snapHeight. */
  height_m: number;
  responsibility: ResponsibilityLevel;
  svCode: string;
  variant?: string;
}

/** Найти вариант сечений рамы в банке. Возвращает undefined, если комбинация не просчитана. */
export function findFrameSelection(query: FrameSelectionQuery): FrameSelection | undefined {
  const heightBucket = snapHeight(query.span, query.height_m);
  const variant = query.variant ?? "стандарт";
  return bank.find(
    (row) =>
      row.span === query.span &&
      row.heightBucket === heightBucket &&
      row.responsibility === query.responsibility &&
      row.svCode === query.svCode &&
      row.variant === variant,
  );
}

/** Все строки банка — для отладки/тестов/построения справочных таблиц в UI. */
export function getAllFrameSelections(): readonly FrameSelection[] {
  return bank;
}
