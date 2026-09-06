import ladderRaw from "../../data/snowLadder.json";
import type { ResponsibilityLevel } from "../../types/common";

interface LadderStep {
  "порог_кПа": number;
  "район_γn1": string | null;
  "k_γn1": number | null;
  "несущая_кПа": number | null;
  "район_γn08": string | null;
  "k_γn08": number | null;
}

interface LadderFile {
  "надбавка_покрытия": Record<string, number>;
  "ступени": LadderStep[];
}

const ladder = ladderRaw as unknown as LadderFile;

export interface BankBlock {
  /** Снеговой район по лестнице ИНСИ — им подписан блок банка сечений. */
  snowDistrict: string;
  /** Коэффициент k блока банка (подбор!W9). */
  bankK: ResponsibilityLevel;
  /**
   * Нагрузка, которую держит выбранная пара «район × k», кН/м².
   * Именно она должна быть не меньше фактической (со скидкой на покрытие).
   */
  designLoad_kPa: number;
  /** Нагрузка, по которой шёл поиск: снег + надбавка за покрытие. */
  lookupLoad_kPa: number;
  /** Надбавка за тип покрытия, кН/м². */
  roofingSupplement_kPa: number;
}

/**
 * Надбавка к снеговой нагрузке за тип покрытия (снегветер!AM6:AN23).
 * Тяжёлая кровля прибавляет, лёгкий профлист снимает 0,1 кПа.
 */
export function roofingSupplement_kPa(roofingType: string): number {
  return ladder["надбавка_покрытия"][roofingType] ?? 0;
}

/**
 * Снеговой район и коэффициент k блока банка — по снеговой нагрузке.
 *
 * Это то самое место, где ИНСИ расходится с прямым чтением СП: район у
 * них выводится не из справочника, а из НАГРУЗКИ через лестницу порогов
 * (снегветер!AB5:AH53), причём вместе с районом лестница выдаёт и
 * коэффициент k, которым подписан блок банка сечений.
 *
 * Смысл пары «район + k» — несущая способность: столбец AE исходника, то
 * есть район × k. Лестница подбирает самую дешёвую пару, которая ещё
 * держит фактическую нагрузку. Поэтому у одного и того же города при
 * γn = 1 и γn = 0,8 могут получиться РАЗНЫЕ районы и разные k, и поэтому
 * же Берёзовский с его 1,5 кПа попадает в IV с k = 0,8 (несущая 1,6),
 * а не в III, как сказал бы СП напрямую.
 *
 * Поиск — как ПОИСКПОЗ с приблизительным совпадением: берётся последняя
 * ступень, порог которой не превышает нагрузку.
 *
 * ВНИМАНИЕ: лестница допускает перебор. На каждой границе района два
 * последних порога держат ещё старую пару, так что фактическая нагрузка
 * может превышать несущую способность блока на величину до 0,10 кПа
 * (например 1,7 кПа считается по паре IV × 0,8, которая держит 1,6).
 * Это правило ИНСИ, воспроизводим как есть — см. вопрос расчётчику.
 *
 * Проверено на четырёх городах подборщика:
 *   Берёзовский  1,5 + 0,1 = 1,6 → IV / 0,8   (γn=0,8: III / 0,8)
 *   Сургут       1,8 + 0,1 = 1,9 → IV / 1,0   (γn=0,8: III / 1,0)
 *   Новосибирск  1,6 + 0,1 = 1,7 → IV / 0,8   (γn=0,8: III / 1,0)
 *   Челябинск    1,2 + 0,1 = 1,3 → III / 0,8  (γn=0,8: III / 0,8)
 */
export function selectBankBlock(
  snowLoad_kPa: number,
  roofingType: string,
  gammaN: ResponsibilityLevel,
): BankBlock | null {
  const supplement = roofingSupplement_kPa(roofingType);
  const lookup = snowLoad_kPa + supplement;

  let step: LadderStep | null = null;
  for (const candidate of ladder["ступени"]) {
    if (candidate["порог_кПа"] <= lookup) step = candidate;
    else break;
  }
  if (!step) return null;

  const district = gammaN === 0.8 ? step["район_γn08"] : step["район_γn1"];
  const k = gammaN === 0.8 ? step["k_γn08"] : step["k_γn1"];
  // Верхние ступени помечены «уточнить у главного конструктора».
  if (district === null || k === null || step["несущая_кПа"] === null) return null;

  return {
    snowDistrict: district,
    bankK: k as ResponsibilityLevel,
    designLoad_kPa: step["несущая_кПа"],
    lookupLoad_kPa: lookup,
    roofingSupplement_kPa: supplement,
  };
}
