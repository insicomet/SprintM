export interface SandwichPanelOption {
  thickness_mm: number;
  wallPriceZLock: number | null;
  wallPriceSecretFix: number | null;
  roofPrice: number | null;
  weight_kg_m2: number | null;
}

export interface CladdingEstimate {
  area_m2: number;
  thickness_mm: number;
  pricePerM2: number | null;
  /** Стоимость, ₽ — null, если для этой толщины нет цены (см. "-" в прайс-листе). */
  cost: number | null;
  /** Масса, кг — null, если вес неизвестен. */
  mass_kg: number | null;
}
