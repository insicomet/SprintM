/** Разобранные размеры сечения ПГС (профиль гнутый сигма), основной профиль рамы. */
export interface PgsDimensions {
  /** Высота профиля, мм (300 или 245). */
  h_mm: number;
  /** Ширина полки, мм (обычно 80). */
  b_mm: number;
  /** Толщина металла, мм. */
  t_mm: number;
}

// Имена в банке сечений выглядят как "ПГС300/20х80х1,5", иногда с хвостом
// вида " М.П.390", " с распорками", " сг по Р" (варианты для пролёта 24м,
// см. вариант "стандарт"/"вариант_2" в sectionBank.json) — хвост игнорируется.
const PGS_NAME_RE = /^ПГС(\d+)\/20х(\d+)х([\d,]+)/;

/** Разобрать имя профиля рамы из банка сечений ("ПГС300/20х80х1,5" -> {h_mm, b_mm, t_mm}). */
export function parsePgsName(name: string): PgsDimensions | null {
  const match = PGS_NAME_RE.exec(name);
  if (!match) return null;
  return {
    h_mm: Number(match[1]),
    b_mm: Number(match[2]),
    t_mm: Number(match[3].replace(",", ".")),
  };
}
