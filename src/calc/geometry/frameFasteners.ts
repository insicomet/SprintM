import type { Span } from "../../types/common";
import type { BuildingGeometry } from "./types";

export interface FastenerItem {
  name: string;
  /** Количество, шт — как в исходной ведомости, без округления. */
  count: number;
  unitMass_kg: number;
  unitPrice: number;
  mass_kg: number;
  cost: number;
  /** true, если для этого пролёта ставка не подтверждена ни одним реальным проектом. */
  isEstimated: boolean;
}

export interface FrameFastenersTakeoff {
  items: FastenerItem[];
  totalMass_kg: number;
  totalCost: number;
}

/**
 * Масса и цена единицы крепежа.
 *
 * Все значения взяты из двух реальных ведомостей ("22316" и "22318",
 * лист "12м") и в них полностью совпадают. Цены в исходнике ссылаются на
 * внешние прайсы ("[4]Перекупные" и др.), самих книг у нас нет, но
 * закэшированные значения присутствуют.
 *
 * ВРЕМЕННОЕ РЕШЕНИЕ: цены намеренно взяты из кэша ведомостей, а не из
 * прайс-листа, чтобы итог приложения можно было сверить с расчётом
 * расчётчика позиция в позицию. После достижения полного совпадения их
 * нужно перевести на актуальный прайс — там значения другие.
 */
const FASTENER_UNITS = {
  // Фасонки ФС-1/ФС-2 (1,40 кг) и ФС-3 (0,50 кг) — см. описание ниже.
  fc11_14: { name: "Фс11, Фс14", unitMass_kg: 1.4, unitPrice: 291 },
  fc12: { name: "Фс12", unitMass_kg: 0.5, unitPrice: 114 },
  screw525: { name: "Саморез 5,5x25", unitMass_kg: 0.0043, unitPrice: 2.2885 },
  dowel: { name: "Дюбель-гвоздь 6х60", unitMass_kg: 0.0048, unitPrice: 1.6215 },
  boltM12: { name: "Болт М12х40", unitMass_kg: 0.05, unitPrice: 11.661 },
  nutM12: { name: "Гайка М12", unitMass_kg: 0.016, unitPrice: 5.129 },
  washerM12: { name: "Шайба 12", unitMass_kg: 0.005, unitPrice: 0.9775 },
  boltM16: { name: "Болт М16х50", unitMass_kg: 0.12, unitPrice: 27.3125 },
  nutM16: { name: "Гайка М16", unitMass_kg: 0.037, unitPrice: 13.3515 },
  washerM16: { name: "Шайба 16 пруж", unitMass_kg: 0.011, unitPrice: 2.3805 },
} as const;

/**
 * Ставка "саморезов 5,5x25 на одну раму" по пролёту — вручную вбитая
 * оценщиком константа (формула вида "=K90*634"). Совпадает с рукописной
 * запиской расчётчика; из реальных проектов подтверждены 15м (614) и
 * 18м (634), остальные — только по записке.
 */
const SCREW_525_RATE_BY_SPAN: Partial<Record<Span, number>> = {
  12: 530,
  15: 614,
  18: 634,
  21: 890,
};

/**
 * "Болт М16х50 (на раму)" — формула ячейки O88:
 *
 *   на_раму = base + coef×(рам−2)/рам + 12×8/рам + 12×2/рам
 *
 * Коэффициент зависит от ПРОЛЁТА: 30 для 9/12/15 м, 50 для 18/21/24 м.
 * Так в рукописной записке расчётчика, так в «22316» (18 м → 50) и
 * «22318» (15 м → 30).
 *
 * В «22285» при пролёте 18 м стоит 30, и какое-то время я вёл
 * коэффициент по шагу рам — правило по шагу сходилось на всех трёх
 * файлах. Расчётчик посмотрела и сказала: «в 22285 должно быть 50,
 * а не 30, там ошибка». Поэтому вернулись к пролёту, а «22285» на этой
 * строке расходится с нами намеренно — см. buildBill.test.ts.
 */
const BOLT_M16_COEF_BY_SPAN: Record<Span, number> = {
  9: 30, 12: 30, 15: 30, 18: 50, 21: 50, 24: 50,
};
/**
 * Первое слагаемое формулы болтов М16 на раму — это «Болты в раме» из
 * ВЫБРАННОЙ строки банка сечений, а не константа по пролёту.
 *
 * Подтверждено на обоих проектах: "22316" (18м, k=0,8, с/в 4/1) — в банке
 * 308, и в ведомости O88 = 308+50*(рам−2)/рам+…; "22318" (15м, k=1,0,
 * с/в 4/1) — в банке 276, и O88 = 276+30*(рам−2)/рам+…
 *
 * Эти же значения оставлены запасным вариантом на случай, когда строка
 * банка не передана.
 */
const BOLT_M16_BASE_BY_SPAN: Partial<Record<Span, number>> = { 15: 276, 18: 308 };

/** Ставка болтов М12х40 — "=16*K90" в обоих реальных проектах, от пролёта не зависит. */
const BOLT_M12_RATE_PER_FRAME = 16;

/** Пролёты, подтверждённые реальными проектами. */
const CONFIRMED_SPANS: readonly Span[] = [15, 18];

function screw525Rate(span: Span): number {
  return SCREW_525_RATE_BY_SPAN[span] ?? (span < 12 ? 530 : 890);
}

function boltM16PerFrame(span: Span, frameCount: number, boltsInFrame?: number): number {
  // Без строки банка base экстраполируется по двум известным точкам
  // (32 на 3 метра пролёта ≈ 10,67 на метр) — заведомо приблизительно.
  const base = boltsInFrame ?? BOLT_M16_BASE_BY_SPAN[span] ?? 276 + ((span - 15) * 32) / 3;
  const coef = BOLT_M16_COEF_BY_SPAN[span];
  return base + (coef * (frameCount - 2)) / frameCount + (12 * 8) / frameCount + (12 * 2) / frameCount;
}

/**
 * Ведомость крепежа каркаса.
 *
 * Формулы количеств (все подтверждены совпадением в обеих реальных
 * ведомостях, файлы "22316" и "22318", лист "12м" — единственный лист,
 * на котором расчётчик реально работает):
 *
 *   Фс11, Фс14        = кол-во_рам × (пролёт + 2×высота) / 0,6
 *   Фс12              = 2 × Фс11,Фс14
 *   Саморез 5,5x25    = кол-во_рам × ставка(пролёт)
 *   Дюбель-гвоздь     = периметр / 0,5 + 1
 *   Болт М12х40       = кол-во_рам × 16
 *   Болт М16х50       = кол-во_рам × на_раму(пролёт, кол-во_рам)
 *   Гайки и шайбы     = количеству соответствующих болтов
 *
 * "Фс" — это ФАСОНКА, а не крепёж (расчётчик прислал чертежи КМД):
 *
 *   Фс11 — марка ФС-1, гнутая из полосы Фд-4 [-275х1,5] Мп350,
 *          250 × 252 × 80 мм, без отверстий, 1,40 кг;
 *   Фс14 — марка ФС-2, та же геометрия, но с 4 отверстиями Ø19, 1,40 кг;
 *   Фс12 — марка ФС-3, из полосы Фд-1 [-150х1,5] Мп350, 255 × 150 мм
 *          с отбортовкой 10 мм, 0,50 кг.
 *
 * Отсюда и одна строка на Фс11 с Фс14: у них одинаковые масса и цена,
 * различаются только отверстиями. Шаг 0,6 м в формуле — это шаг, с
 * которым фасонки сшивают два профиля ПГС-сигма спаренного сечения по
 * контуру рамы (ригель плюс две колонны), а на каждую такую фасонку
 * приходится две Фс12.
 *
 * Не путать с "Листом" из раздела дополнительных материалов: там
 * узловые пластины t5/t6, вырезанные из листа 5-6 мм и посчитанные
 * тоннами, — другая деталь, двойного счёта нет.
 *
 * Накладные расходы (2%) здесь не начисляются: в исходнике они идут на
 * раздел целиком, а разделы смешивают крепёж с другими позициями.
 */
export function computeFrameFasteners(
  geometry: Pick<BuildingGeometry, "span_m" | "length_m" | "height_m" | "framePitch_m"> & { span_m: Span },
  frameCount: number,
  /** «Болты в раме» выбранной строки банка сечений — база формулы М16. */
  boltsInFrame?: number,
): FrameFastenersTakeoff {
  const { span_m, length_m, height_m } = geometry;
  // Ставка саморезов по-прежнему подтверждена только на двух пролётах.
  const isEstimated = !CONFIRMED_SPANS.includes(span_m);

  const fc11_14Count = (frameCount * (span_m + 2 * height_m)) / 0.6;
  const dowelCount = (2 * (span_m + length_m)) / 0.5 + 1;
  const boltM12Count = frameCount * BOLT_M12_RATE_PER_FRAME;
  const boltM16Count = frameCount * boltM16PerFrame(span_m, frameCount, boltsInFrame);

  const counts: [keyof typeof FASTENER_UNITS, number][] = [
    ["fc11_14", fc11_14Count],
    ["fc12", 2 * fc11_14Count],
    ["screw525", frameCount * screw525Rate(span_m)],
    ["dowel", dowelCount],
    ["boltM12", boltM12Count],
    ["nutM12", boltM12Count],
    ["washerM12", boltM12Count],
    ["boltM16", boltM16Count],
    ["nutM16", boltM16Count],
    ["washerM16", boltM16Count],
  ];

  const items: FastenerItem[] = counts.map(([key, count]) => {
    const { name, unitMass_kg, unitPrice } = FASTENER_UNITS[key];
    return {
      name,
      count,
      unitMass_kg,
      unitPrice,
      mass_kg: count * unitMass_kg,
      cost: count * unitPrice,
      // Дюбель-гвоздь считается по периметру и от пролёта не зависит —
      // его формула одинакова в обоих проектах при разных пролётах.
      isEstimated: key === "dowel" ? false : isEstimated,
    };
  });

  return {
    items,
    totalMass_kg: items.reduce((sum, i) => sum + i.mass_kg, 0),
    totalCost: items.reduce((sum, i) => sum + i.cost, 0),
  };
}
