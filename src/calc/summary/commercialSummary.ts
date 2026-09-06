export interface CommercialLine {
  name: string;
  /** null — если хотя бы одна составляющая статьи ещё не посчитана. */
  cost: number | null;
  /** Чего не хватает в статье, если она неполная. */
  missing?: string;
}

export interface CommercialSummary {
  lines: CommercialLine[];
  /** Материалы с упаковкой — сумма трёх статей. null, если хоть одна неполная. */
  materialsWithPackaging: number | null;
  /** Проёмы — отдельной строкой, упаковка на них не начисляется. */
  openingsCost: number;
  /** Итог к предложению: материалы с упаковкой плюс проёмы. */
  totalCost: number | null;
}

/**
 * Множитель упаковки — 2% в обоих реальных проектах (ячейка E150).
 * В исходнике он «зашит» прямо в строки сводки как ×1,02.
 */
const PACKAGING = 1.02;

export interface CommercialInputs {
  /**
   * Каркас: профили рамы, прогоны, прочие профили, крепёж и связи.
   * Соответствует (F32 + F100) исходника — до умножения на упаковку.
   */
  frameMaterials: number | null;
  /** Стеновое ограждение: уголки У.115 и стеновые панели с крепежом (F44 + F114). */
  wallMaterials: number | null;
  /** Кровельное ограждение: панели, доборные элементы и водосток (F147 + F70 + F81). */
  roofMaterials: number | null;
  /** Окна, ворота и двери — блок «Проемы», F160. */
  openingsCost: number;
  /** Чего не хватает в статье «Каркас», если она неполная. */
  frameMissing?: string;
}

/**
 * Коммерческая сводка — то, что расчётчик отдаёт заказчику.
 *
 * Структура взята из обеих реальных ведомостей (лист "12м",
 * строки 149–160) и в них совпадает:
 *
 *   Каркас                = (F32 + F100) × 1,02
 *   Стеновое ограждение   = (F44 + F114) × 1,02
 *   Кровельное ограждение = (F147 + F70 + F81) × 1,02
 *   ОКНА/ВОРОТА/ДВЕРИ     = площади × цены        (без упаковки)
 *
 * Множитель 1,02 — это и есть упаковка: сумма трёх статей в точности
 * равна строке «ИТОГО Цена + упаковка» (F151). Проверено на "22316":
 * 2 604 657,30 + 1 596 258,67 + 2 329 836,78 = 6 530 752,75.
 *
 * Строки «Перекрытие» и «Перегородки» в обоих проектах равны нулю
 * (разделы отключены), поэтому здесь их нет.
 */
export function computeCommercialSummary(inputs: CommercialInputs): CommercialSummary {
  const withPackaging = (value: number | null) => (value === null ? null : value * PACKAGING);

  const frame = withPackaging(inputs.frameMaterials);
  const wall = withPackaging(inputs.wallMaterials);
  const roof = withPackaging(inputs.roofMaterials);

  const lines: CommercialLine[] = [
    { name: "Каркас", cost: frame, missing: inputs.frameMissing },
    { name: "Стеновое ограждение", cost: wall },
    { name: "Кровельное ограждение", cost: roof },
    { name: "Окна, ворота, двери", cost: inputs.openingsCost },
  ];

  const materialsWithPackaging =
    frame === null || wall === null || roof === null ? null : frame + wall + roof;

  return {
    lines,
    materialsWithPackaging,
    openingsCost: inputs.openingsCost,
    totalCost:
      materialsWithPackaging === null ? null : materialsWithPackaging + inputs.openingsCost,
  };
}
