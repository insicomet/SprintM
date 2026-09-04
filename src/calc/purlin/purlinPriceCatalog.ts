import pricesRaw from "../../data/purlinFamilyPrices.json";

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

interface PurlinPriceFile {
  "ПС": RawPriceRow[];
  "ТПС": RawPriceRow[];
  "ПZ и TПZ": RawPriceRow[];
}

const prices = pricesRaw as unknown as PurlinPriceFile;

export interface PurlinPriceResult {
  /** Цена продажи (+5%) за метр ГОТОВОГО прогона, ₽/м — для 2ПС/2ТПС уже удвоена (пара профилей). */
  priceSale_perM: number | null;
  /** Масса погонного метра готового прогона, кг/м — для сверки с purlinCatalog. */
  massPerM_kg: number | null;
  coating: string;
}

interface Candidate {
  coating: string;
  row: RawPriceRow;
}

// Каталог прогонов (см. purlin/catalog.ts) использует короткие имена вида
// "2ТПС 200х65х2", "2ПС 200х65х1,5", "Z 250х1,5" — "2ТПС"/"2ПС" значит
// ДВА одиночных профиля ТПС/ПС, поставленных встык (прогон в сборе);
// цена и масса прайс-листа при сборке удваиваются. Z — одиночный
// профиль, у него аналог в прайсе — семейство "ПZ".
const DOUBLE_RE = /^(2ТПС|2ПС) (\d+)х(\d+)х([\d,]+)/;
const Z_RE = /^Z (\d+)х([\d,]+)/;

const PS_PRICE_RE = /^ПС (\d+)х(\d+) без перфор\. ([\d,]+)(?:\s+П\d+)?\s*\(([^)]+)\)$/;
const TPS_PRICE_RE = /^ТПС (\d+)х(\d+) с перфор\. ([\d,]+)(?:\s+П\d+)?\s*\(([^)]+)\)$/;
const PZ_PRICE_RE = /^ПZ (\d+) без перфор\. ([\d,]+)(?:\s+П\d+)?\s*\(([^)]+)\)$/;

function findWithWidth(rows: RawPriceRow[], re: RegExp, h_mm: number, b_mm: number, t_mm: number): Candidate[] {
  const out: Candidate[] = [];
  for (const row of rows) {
    const m = re.exec(row.name);
    if (!m) continue;
    const [, h, b, t, coating] = m;
    if (Number(h) === h_mm && Number(b) === b_mm && Number(t.replace(",", ".")) === t_mm) {
      out.push({ coating, row });
    }
  }
  return out;
}

function findWithoutWidth(rows: RawPriceRow[], re: RegExp, h_mm: number, t_mm: number): Candidate[] {
  const out: Candidate[] = [];
  for (const row of rows) {
    const m = re.exec(row.name);
    if (!m) continue;
    const [, h, t, coating] = m;
    if (Number(h) === h_mm && Number(t.replace(",", ".")) === t_mm) {
      out.push({ coating, row });
    }
  }
  return out;
}

function pickPreferred(candidates: Candidate[], preferredCoating: string): Candidate | null {
  if (candidates.length === 0) return null;
  return candidates.find((c) => c.coating === preferredCoating) ?? candidates[0];
}

/**
 * Найти цену/массу для профиля прогона по его короткому имени из
 * purlinCatalog ("2ТПС 200х65х2", "2ПС 200х65х1,5", "Z 250х1,5").
 */
export function findPurlinPrice(profileName: string, preferredCoating = "Оцинк."): PurlinPriceResult | null {
  const doubleMatch = DOUBLE_RE.exec(profileName);
  if (doubleMatch) {
    const [, family, h, b, t] = doubleMatch;
    const rows = family === "2ТПС" ? prices["ТПС"] : prices["ПС"];
    const re = family === "2ТПС" ? TPS_PRICE_RE : PS_PRICE_RE;
    const picked = pickPreferred(
      findWithWidth(rows, re, Number(h), Number(b), Number(t.replace(",", "."))),
      preferredCoating,
    );
    if (!picked) return null;
    return {
      priceSale_perM: picked.row.priceSale !== null ? picked.row.priceSale * 2 : null,
      massPerM_kg: picked.row.weight_kg !== null ? picked.row.weight_kg * 2 : null,
      coating: picked.coating,
    };
  }

  const zMatch = Z_RE.exec(profileName);
  if (zMatch) {
    const [, h, t] = zMatch;
    const picked = pickPreferred(
      findWithoutWidth(prices["ПZ и TПZ"], PZ_PRICE_RE, Number(h), Number(t.replace(",", "."))),
      preferredCoating,
    );
    if (!picked) return null;
    return {
      priceSale_perM: picked.row.priceSale,
      massPerM_kg: picked.row.weight_kg,
      coating: picked.coating,
    };
  }

  return null;
}
