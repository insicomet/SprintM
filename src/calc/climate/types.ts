/** Климатические данные населённого пункта (подмножество полей из settlementsClimate.json). */
export interface SettlementClimate {
  id: string;
  settlement: string;
  region: string;
  snow: {
    /** Снеговой район (I…VIII, "Iа"), null если не определён. */
    region: string | null;
    sgKpa: number | null;
  };
  wind: {
    /** Ветровой район (Ia, I…VII), null если не определён. */
    region: string | null;
    w0Kpa: number | null;
  };
}

/** Код "с/в" (снег/ветер), например "4/1" — как используется в банке сечений ИНСИ. */
export type SvCode = string;

export interface SvCodeResult {
  city: SettlementClimate;
  /** Код по фактическим снеговому/ветровому районам (до нормализации), например "4/2". */
  raw: SvCode;
  /**
   * Нормализованный код — приведён к одной из комбинаций, для которых
   * в банке сечений ИНСИ реально есть просчитанные данные.
   */
  standard: SvCode;
}
