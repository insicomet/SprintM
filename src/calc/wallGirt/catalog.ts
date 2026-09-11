import pricesRaw from "../../data/framePGSPrices.json";
import type { GirtProfileOption } from "./types";

interface RawPriceRow {
  name: string;
  code: number | null;
  group: string | null;
  price0: number | null;
  unit: string | null;
  weight_kg: number | null;
  pricePerTon: number | null;
  priceSale: number | null;
}

interface FramePriceFile {
  ПС: RawPriceRow[];
  ПП: RawPriceRow[];
  ТПС: RawPriceRow[];
  ТПП: RawPriceRow[];
}

const prices = pricesRaw as unknown as FramePriceFile;

// "ПС 145х45 без перфор. 1,2 (Оцинк.)" / "ТПП 145х45 с перфор. 1,5 П350 (Оцинк.) "
const NAME_RE =
  /^(ПС|ПП|ТПС|ТПП) (\d+)[xх](\d+) (?:без|с) перфор\. ([\d,]+)(?:\s+П\d+)?\s*\(([^)]+)\)\s*$/;

/**
 * Прайс держит одну и ту же позицию несколько раз — отдельно для
 * "П350"/"П390" (стальной класс, влияющий на допустимый момент, не на
 * вес/цену) и отдельно для отделки ("Оцинк."/"Колор-поток..."). Для
 * обвязки стен материал (МП220/350/390) в упрощённом режиме ни на что
 * не влияет (авто-подбор по несущей способности не делаем — см. вопрос
 * расчётчику про ветровое зонирование), поэтому берём один — базовый
 * оцинкованный — вариант на профиль/толщину.
 */
function parseFamily(rows: RawPriceRow[] | undefined, coating = "Оцинк."): GirtProfileOption[] {
  if (!rows) return [];
  const seen = new Map<string, GirtProfileOption>();
  for (const row of rows) {
    const match = NAME_RE.exec(row.name.trim());
    if (!match || row.weight_kg == null) continue;
    const [, family, h, b, thicknessStr, coatingName] = match;
    if (coatingName !== coating) continue;
    const size = `${h}х${b}`;
    const key = `${family} ${size} ${thicknessStr}`;
    if (seen.has(key)) continue; // дубль П350/П390 с тем же весом/ценой — берём первую строку
    seen.set(key, {
      name: `${family} ${size}х${thicknessStr}`,
      family: family as GirtProfileOption["family"],
      size,
      thickness_mm: Number(thicknessStr.replace(",", ".")),
      weightPerMeter_kg: row.weight_kg,
      pricePerMeter: row.priceSale ?? row.price0,
    });
  }
  return [...seen.values()];
}

const SINGLE_PROFILES: readonly GirtProfileOption[] = [
  ...parseFamily(prices.ПС),
  ...parseFamily(prices.ПП),
  ...parseFamily(prices.ТПС),
  ...parseFamily(prices.ТПП),
];

/** Одинарные профили обвязки (ПС/ПП/ТПС/ТПП) — вес и цена из прайса 1С. */
export function getGirtProfileOptions(): readonly GirtProfileOption[] {
  return SINGLE_PROFILES;
}

/**
 * Спаренный вариант того же профиля («2ПС», «2ТПС» и т.п. в исходном
 * калькуляторе) — вес и цена удваиваются.
 *
 * Проверено: банк прогонов (purlinCatalog390.json) держит «2ПС
 * 145х45х1,5» = 5,9 кг/м, а 2× вес одинарного профиля из СВЕЖЕГО прайса
 * 1С (11.09.2026, 2,9522 кг/м) даёт 5,9044 кг/м — расхождение 0,08%,
 * то есть удвоение — верное правило, не только для этого одного типоразмера.
 */
export function pairedGirtProfile(single: GirtProfileOption): GirtProfileOption {
  const thicknessStr = String(single.thickness_mm).replace(".", ",");
  return {
    ...single,
    name: `2${single.family} ${single.size}х${thicknessStr}`,
    weightPerMeter_kg: single.weightPerMeter_kg * 2,
    pricePerMeter: single.pricePerMeter != null ? single.pricePerMeter * 2 : null,
  };
}

/** Найти профиль по названию одинарного варианта из каталога, спаренный — по флагу. */
export function findGirtProfile(name: string, paired: boolean): GirtProfileOption | null {
  const single = SINGLE_PROFILES.find((o) => o.name === name);
  if (!single) return null;
  return paired ? pairedGirtProfile(single) : single;
}
