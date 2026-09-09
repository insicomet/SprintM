/**
 * Один размер проёма — количество, ширина, высота.
 *
 * До вопроса 02 приложение держало по одному размеру на тип проёма
 * (ворота/двери/окна) и сводило разные размеры в один, сохраняя число и
 * площадь. Расчётчик подтвердила, что сама она поступает иначе: «когда
 * размеров больше, чем слотов, я вручную добавляю слот». Поэтому теперь
 * каждый тип проёма — это СПИСОК таких размеров, а не одно число, — как
 * и у неё.
 */
export interface OpeningGroup {
  count: number;
  width_m: number;
  height_m: number;
  /**
   * Ворота на длинной стене раздвигают ту раму, у которой стоят — шаг там
   * должен быть не меньше ширины ворот + 0,8 м, иначе рама перекроет
   * проём (расчётчик: «раздвижка рамы встречается как в обычных
   * спринтах, так и в нов.конструктиве, так что это общее правило»).
   * На торце раздвигать нечего — там рамы и так по краям здания.
   * Используется только для ворот; для дверей и окон не имеет смысла.
   */
  onLongWall?: boolean;
}

/** Минимальная надбавка к ширине ворот для раздвинутой рамы, м. */
const GATE_FRAME_CLEARANCE_M = 0.8;

/**
 * Шаг каждой раздвинутой под ворота рамы, м — по одному значению на
 * каждые ворота на длинной стене (`count` штук каждый).
 *
 * Если раздвинутый шаг выходит меньше стандартного (узкие ворота при
 * широком шаге рам), раздвигать незачем — берём больший из двух.
 */
export function widenedGateBays_m(gates: readonly OpeningGroup[], framePitch_m: number): number[] {
  const bays: number[] = [];
  for (const gate of gates) {
    if (!gate.onLongWall) continue;
    const bay = Math.max(framePitch_m, gate.width_m + GATE_FRAME_CLEARANCE_M);
    for (let i = 0; i < gate.count; i++) bays.push(bay);
  }
  return bays;
}

export interface OpeningsInput {
  gates: OpeningGroup[];
  doors: OpeningGroup[];
  windows: OpeningGroup[];
}

export const DEFAULT_OPENINGS: OpeningsInput = {
  gates: [{ count: 1, width_m: 4, height_m: 4.5 }],
  doors: [{ count: 1, width_m: 1, height_m: 2.1 }],
  windows: [],
};

/** Сумма count×width×height по списку размеров одного типа проёма, м². */
function groupsArea_m2(groups: readonly OpeningGroup[]): number {
  return groups.reduce((s, g) => s + g.count * g.width_m * g.height_m, 0);
}

/** Сумма количества по списку размеров одного типа проёма. */
export function groupsCount(groups: readonly OpeningGroup[]): number {
  return groups.reduce((s, g) => s + g.count, 0);
}

/** Суммарная площадь проёмов (ворота + двери + окна), м² — по фактическим размерам. */
export function computeOpeningsArea_m2(openings: OpeningsInput): number {
  return gatesArea_m2(openings) + doorsArea_m2(openings) + windowsArea_m2(openings);
}

/**
 * Округление размера проёма для ВЫЧЕТА из площади стен — вниз до целых
 * метров, и ширина, и высота (правило подтверждено расчётчиком).
 *
 * Отсюда та разница, которую я полгода считал опиской: в "22316" ворота
 * 4 × 4,2 стоят в блоке проёмов как есть, а из стены вычитаются как
 * 4 × 4 — то есть 16 м² вместо 16,8. В "22318" все размеры и так целые,
 * поэтому там расхождения не видно.
 */
function floorToWholeMetres(size_m: number): number {
  // Округляем до шестого знака перед отбрасыванием дробной части, иначе
  // 3 м, пришедшие как 2,9999999, превратились бы в 2.
  return Math.floor(Number(size_m.toFixed(6)));
}

function groupsDeduction_m2(groups: readonly OpeningGroup[]): number {
  return groups.reduce(
    (s, g) => s + g.count * floorToWholeMetres(g.width_m) * floorToWholeMetres(g.height_m),
    0,
  );
}

/**
 * Площадь проёмов, вычитаемая из площади стен под обшивку, м².
 *
 * Не равна computeOpeningsArea_m2: в ведомости вычет записан отдельной
 * формулой с округлёнными размерами (лист "12м", C102), тогда как в
 * блоке "Проемы" и в стоимости проёмы идут по фактическим размерам.
 *
 *   "22316": −1×30×1 − 2×1×1 − 4×4×1  →  30 + 2 + 16 = 48 м²
 *            (ворота при этом 4 × 4,2 = 16,8 м² в блоке проёмов)
 *   "22318": −3×3×2 − 1×2×1           →  18 + 2 = 20 м²
 *
 * При нескольких размерах на тип каждый размер округляется и вычитается
 * отдельно — так же, как отдельными строками стоял бы каждый слот в
 * ведомости.
 */
export function computeOpeningsDeduction_m2(o: OpeningsInput): number {
  return groupsDeduction_m2(o.gates) + groupsDeduction_m2(o.doors) + groupsDeduction_m2(o.windows);
}

function gatesArea_m2(o: OpeningsInput): number {
  return groupsArea_m2(o.gates);
}

function doorsArea_m2(o: OpeningsInput): number {
  return groupsArea_m2(o.doors);
}

export function windowsArea_m2(o: OpeningsInput): number {
  return groupsArea_m2(o.windows);
}

/**
 * Длина окна для обрамления (L156) округляется ВВЕРХ до ближайшего
 * кратного шагу рам — так подтвердила расчётчик по вопросу 01: «длина
 * обрамления окна должна быть кратна шагу рам».
 *
 * Физика простая: угловое обрамление ленточного окна — это стойки в
 * каждой раме, а рамы стоят с шагом. Обрамление короче окна не бывает,
 * поэтому длина округляется вверх, а не вниз, и не бывает короче одного
 * шага, даже если само окно у́же (иначе делить не на что).
 *
 * Округление до шестого знака перед делением — как и в
 * floorToWholeMetres, страховка от 30 - ε, пришедших числом с плавающей
 * точкой.
 */
function roundUpToFramePitch(width_m: number, framePitch_m: number): number {
  if (framePitch_m <= 0) return width_m;
  const bays = Math.ceil(Number((width_m / framePitch_m).toFixed(6)) - 1e-9);
  return Math.max(1, bays) * framePitch_m;
}

/**
 * Периметр обрамления оконных проёмов, п.м — по нему в ведомости идёт
 * уголок 80х4 в строке «Конструкции из труб»:
 *
 *   L156 = 2 × (ширина_кратная_шагу + высота) × количество
 *
 * НЕ РАВНО «в ведомости стоит»: в исходнике ширина в L156 — это не
 * ссылка на ячейку окна (J160), а число, которое расчётчик вписывает
 * заново руками, уже округлив его до кратного шагу рам. В "22318" и
 * "22285" (окно 46 м, шаг 4) там стоит 48 — округление сошлось. А в
 * "22316" (окно 30 м, шаг 4,5) там стоит 30 как есть — расчётчик
 * подтвердила, что это ОШИБКА файла: «Там ошибка, обрамление должно
 * быть 31,5 м» (7 шагов × 4,5). Раньше это число мы брали как есть,
 * чтобы «22316» сходился с файлом до копейки; теперь, когда сама
 * ошибка подтверждена, считаем по правилу и с «22316» расходимся
 * намеренно на этой строке — см. openings.test.ts и buildBill.test.ts.
 *
 * При нескольких размерах окон каждый считается своим слотом (своя
 * ширина, своё округление) и складывается — как в ведомости, где
 * второй размер занял бы вторую строку блока «Проемы».
 */
export function windowFramingPerimeter_m(o: OpeningsInput, framePitch_m: number): number {
  return o.windows.reduce((sum, g) => {
    if (g.count <= 0) return sum;
    const width_m = roundUpToFramePitch(g.width_m, framePitch_m);
    return sum + 2 * (width_m + g.height_m) * g.count;
  }, 0);
}

export interface OpeningsCostItem {
  name: string;
  area_m2: number;
  /** Цена за м² проёма — ворота и двери в исходнике тоже считаются по площади, не поштучно. */
  unitPrice: number;
  cost: number;
}

export interface OpeningsCost {
  items: OpeningsCostItem[];
  totalCost: number;
}

/**
 * Цены проёмов, ₽/м². Закэшированы в обеих реальных ведомостях (лист
 * "12м", ячейки N160/N162/N163) и совпадают.
 *
 * ВРЕМЕННОЕ РЕШЕНИЕ: как и в остальных разделах, взяты из кэша
 * ведомости, а не из прайса, чтобы итог сходился с расчётом расчётчика.
 */
const OPENING_PRICES = {
  windows: 6094.999999999999,
  doors: 29462.999999999996,
  gates: 40480,
} as const;

/**
 * Стоимость проёмов — отдельная строка коммерческого предложения,
 * которая не входит ни в материалы, ни в упаковку.
 *
 * В исходнике это блок "Проемы" (строки 160–163) с итогом в ячейке F160:
 *
 *   F160 = площадь_окон × цена + площадь_дверей × цена + площадь_ворот × цена
 *
 * Ворота и двери считаются по квадратуре так же, как окна. Несколько
 * размеров одного типа складываются по площади — цена от размера не
 * зависит, только от площади и типа.
 *
 * Контрольные значения: "22316" (окна 30 м², двери 2 м², ворота 16,8 м²)
 * -> 921 840 ₽; "22318" (дверь 2 м², ворота 18 м²) -> 787 566 ₽.
 */
export function computeOpeningsCost(openings: OpeningsInput): OpeningsCost {
  const items: OpeningsCostItem[] = [
    { name: "Окна", area_m2: windowsArea_m2(openings), unitPrice: OPENING_PRICES.windows },
    { name: "Двери", area_m2: doorsArea_m2(openings), unitPrice: OPENING_PRICES.doors },
    { name: "Ворота", area_m2: gatesArea_m2(openings), unitPrice: OPENING_PRICES.gates },
  ].map((i) => ({ ...i, cost: i.area_m2 * i.unitPrice }));

  return { items, totalCost: items.reduce((sum, i) => sum + i.cost, 0) };
}
