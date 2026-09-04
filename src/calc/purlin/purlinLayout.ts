import { findPurlinPrice } from "./purlinPriceCatalog";
import type { PurlinSelectionResult } from "./types";

export interface PurlinLayout {
  /** Число линий прогонов по всей ширине ската(ов), включая крайние (у конька и у карниза). */
  lineCount: number;
  /** Суммарная длина прогонов на здание, м. */
  totalLength_m: number;
  /** Суммарная масса прогонов на здание, кг — null, если масса погонного метра неизвестна. */
  totalMass_kg: number | null;
  /** Суммарная стоимость прогонов, ₽ — null, если профиль не нашёлся в прайс-листе. */
  totalCost: number | null;
}

/**
 * Раскладка прогонов по всей кровле: сколько линий прогонов умещается
 * по длине ската(ов) при принятом шаге, и какая суммарная длина/масса
 * получается на здание (каждая линия тянется на всю длину здания).
 *
 * Схема та же, что и для количества рам (CEILING + 1 — линии стоят по
 * краям и с шагом между ними).
 */
export function computePurlinLayout(
  purlin: PurlinSelectionResult,
  rafterLength_m: number,
  buildingLength_m: number,
): PurlinLayout {
  const step_m = purlin.step_mm / 1000;
  const lineCount = Math.ceil(rafterLength_m / step_m + 1);
  const totalLength_m = lineCount * buildingLength_m;
  const totalMass_kg = totalLength_m * purlin.profile.mass_kg_per_m;

  const price = findPurlinPrice(purlin.profile.name);
  const totalCost = price?.priceSale_perM != null ? price.priceSale_perM * totalLength_m : null;

  return { lineCount, totalLength_m, totalMass_kg, totalCost };
}
