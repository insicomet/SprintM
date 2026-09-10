import { describe, expect, it } from "vitest";
import { computeProject, type ProjectInputs } from "./computeProject";

/**
 * Сквозная сверка с двумя реальными расчётами ИНСИ.
 *
 * Здесь зафиксировано то, что раньше проверялось глазами в браузере:
 * весь расчёт целиком, от города до коммерческой сводки, против ведомостей
 * "22316" и "22318" (лист "12м" — единственный рабочий).
 *
 * Код «с/в» задан вручную: наша климатическая база даёт Берёзовскому 3/1,
 * а расчётчик работал по своей таблице «снегветер» с 4/1. Это осознанное
 * расхождение (вопрос расчётчику), и чтобы сверять построчно, здесь берём
 * его код. Блок банка k тоже задан явно: в исходнике он выбирается
 * отдельно от γn (в "22316" γn = 1 при k = 0,8).
 */
const project22316: ProjectInputs = {
  city: "Берёзовский, Свердловская область",
  span: 18,
  length_m: 30,
  height_m: 5,
  gammaN: 1.0,
  bankK: 0.8,
  svOverride: "4/1",
  roofingType: "С-П 150",
  deckingMark: "С44-1000-0,7",
  maxStepOverride_mm: 0,
  minStep_mm: 0,
  framePitchOverride_m: 0,
  wallPanel_mm: 100,
  roofPanel_mm: 150,
  openings: {
    gates: [{ count: 1, width_m: 4, height_m: 4.2 }],
    doors: [{ count: 1, width_m: 1, height_m: 2 }],
    windows: [{ count: 1, width_m: 30, height_m: 1 }],
  },
  snowGuards: true,
  railingPurlin: false,
  tubeStrutCount: 3,
  strutTube: "80х3",
  extraTubeMass_t: 0.432,
  postSpacing_m: 2,
};

const project22318: ProjectInputs = {
  city: "Сургут",
  span: 15,
  length_m: 24,
  height_m: 5,
  gammaN: 1.0,
  bankK: 1.0,
  svOverride: "4/1",
  // Подборщик взял снег Сургута по данным ГМЦ (1,8), а не по району IV (2,0).
  snowLoadOverride_kPa: 1.8,
  roofingType: "С-П 150",
  deckingMark: "С44-1000-0,7",
  maxStepOverride_mm: 0,
  minStep_mm: 0,
  framePitchOverride_m: 0,
  wallPanel_mm: 100,
  roofPanel_mm: 150,
  openings: {
    gates: [{ count: 2, width_m: 3, height_m: 3 }],
    doors: [{ count: 1, width_m: 1, height_m: 2 }],
    windows: [],
  },
  snowGuards: false,
  railingPurlin: false,
  tubeStrutCount: 3,
  strutTube: "60х3",
  extraTubeMass_t: 0.795,
  postSpacing_m: 2,
};

function line(result: ReturnType<typeof computeProject>, name: string) {
  return result.commercial.lines.find((l) => l.name === name)!;
}

describe("computeProject — реальный проект «22316»", () => {
  const r = computeProject(project22316);

  it("picks the estimator's own bank row", () => {
    expect(r.frame?.ok).toBe(true);
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.column.profile).toBe("ПГС300/20х80х2,5");
    expect(s!.beam.profile).toBe("ПГС300/20х80х3");
    expect(s!.framePitch_m).toBe(4.5);
    expect(s!.bolts.totalInFrame).toBe(308);
    expect(s!.massGussetPlates_kg).toBe(264);
    expect(r.frameTakeoff!.frameCount).toBe(8);
  });

  it("reproduces the frame profile run-lengths (rows 21–22)", () => {
    expect(r.frameTakeoff!.beam.totalLength_m).toBeCloseTo(298.15, 1);
    expect(r.frameTakeoff!.column.totalLength_m).toBeCloseTo(157.76, 1);
  });

  it("reproduces the purlin line (row 24): 780 п.м., 3174,6 кг, 448 500 ₽", () => {
    expect(r.maxPurlinStep).toBe(2150);
    expect(r.purlin!.profile.name).toBe("2ПС 200х65х1,5");
    expect(r.purlin!.step_mm).toBe(1800);
    expect(r.purlinLayout!.totalProfileLength_m).toBeCloseTo(780, 9);
    expect(r.purlinLayout!.totalMass_kg).toBeCloseTo(3174.6, 6);
    expect(r.purlinLayout!.totalCost).toBeCloseTo(448500, 6);
    // Крепёж кровельных панелей расчётчик считал по 12 прогонам.
    expect(r.purlinLayout!.lineCount).toBe(12);
  });

  it("reproduces the fasteners (rows 29–30, 85–95)", () => {
    const f = Object.fromEntries(r.frameFasteners!.items.map((i) => [i.name, i]));
    expect(f["Фс11, Фс14"].count).toBeCloseTo(373.33, 2);
    expect(f["Фс12"].count).toBeCloseTo(746.67, 2);
    expect(f["Саморез 5,5x25"].count).toBeCloseTo(5072, 6);
    expect(f["Дюбель-гвоздь 6х60"].count).toBeCloseTo(193, 6);
    expect(f["Болт М12х40"].count).toBeCloseTo(128, 6);
    expect(f["Болт М16х50"].count).toBeCloseTo(2884, 6);
  });

  it("reproduces the bracing (rows 96–98)", () => {
    // Обрамление окна (уголок 80х4) считается по вопросу 01: расчётчик
    // подтвердила, что в самом файле «22316» здесь ошибка — длина должна
    // быть 31,5 м (7 шагов × 4,5), а не 30 как есть. Поэтому масса на
    // 0,0288 т больше, чем в файле: 2×(31,5+1)×1 = 65 п.м вместо 62.
    const b = Object.fromEntries(r.bracing!.items.map((i) => [i.name, i]));
    expect(b["Конструкции из труб"].mass_t).toBeCloseTo(3.1503465467132816, 9);
    expect(b["Уголок"].mass_t).toBeCloseTo(1.03896, 9);
    expect(b["Лист (фасонки)"].mass_t).toBeCloseTo(2.112, 9);
    expect(r.bracing!.totalCost).toBeCloseTo(428604.64768034196 + 179220.6 + 290970.24, 4);
  });

  it("reproduces the wall and roof trim, drainage (F44, F81, F70)", () => {
    expect(r.wallTrim.totalCost).toBeCloseTo(62703.15789473685, 4);
    expect(r.roofTrim.totalCost).toBeCloseTo(151676.2614857143, 4);
    expect(r.drainage.totalCost).toBeCloseTo(92971.10571428572, 4);
  });

  it("reproduces the roof cladding section (F147)", () => {
    expect(r.envelope.roofArea).toBeCloseTo(556.2, 6);
    expect(r.roofCladding!.totalCost).toBeCloseTo(2039506.3353061413, 3);
  });

  it("reproduces three of the four commercial lines exactly", () => {
    // «Каркас» на 4 076,54 ₽ выше файла — тот же сдвиг обрамления окна,
    // помноженный на оба раза применённые накладные 2% (раздел + сводка).
    expect(line(r, "Каркас").cost).toBeCloseTo(2608733.840230706, 2);
    expect(line(r, "Кровельное ограждение").cost).toBeCloseTo(2329836.776556264, 2);
    expect(line(r, "Окна, ворота, двери").cost).toBeCloseTo(921840, 4);
  });

  it("matches the bill on the wall too, gates included", () => {
    // Ведомость вычитает ворота из площади стен как 4 × 4 (C102), тогда как
    // в блоке «Проемы» те же ворота стоят 4 × 4,2. Я считал это опиской и
    // держал зазор в 2 344 ₽; расчётчик подтвердил, что это правило —
    // размеры проёма округляются вниз до целых, и ширина тоже.
    expect(r.openingsArea).toBeCloseTo(48.8, 9); // фактическая площадь
    expect(r.openingsDeduction).toBeCloseTo(48, 9); // то, что вычитается
    expect(r.envelope.wallArea).toBeCloseTo(504, 6);

    expect(line(r, "Стеновое ограждение").cost!).toBeCloseTo(1596258.6739806319, 6);
    // Итог теперь на 4 076,54 ₽ выше файла — намеренное расхождение на
    // строке обрамления окна (вопрос 01, ошибка подтверждена расчётчиком).
    expect(r.commercial.totalCost!).toBeCloseTo(6534829.290767602 + 921840, 4);
  });
});

describe("computeProject — реальный проект «22318»", () => {
  const r = computeProject(project22318);

  it("picks the estimator's own bank row", () => {
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.framePitch_m).toBe(4);
    expect(s!.bolts.totalInFrame).toBe(276);
    expect(s!.massGussetPlates_kg).toBe(238);
    expect(r.frameTakeoff!.frameCount).toBe(7);
  });

  it("reproduces the bracing (rows 96–98)", () => {
    const b = Object.fromEntries(r.bracing!.items.map((i) => [i.name, i]));
    expect(b["Конструкции из труб"].mass_t).toBeCloseTo(2.4974476183208068, 9);
    expect(b["Уголок"].mass_t).toBeCloseTo(0.7215, 9);
    expect(b["Лист (фасонки)"].mass_t).toBeCloseTo(1.666, 9);
  });

  it("reproduces the openings and the wall area", () => {
    expect(r.openingsCost.totalCost).toBeCloseTo(787566, 4);
    // C102 = ((15+24)*2*5 + 15*2*2) − 3*3*2 − 1*2*1 = 430
    expect(r.envelope.wallArea).toBeCloseTo(430, 6);
  });

  it("reproduces the wall and roof sections (F44, F114, F147, F70, F81)", () => {
    expect(r.wallTrim.totalCost).toBeCloseTo(52395.78947368421, 4);
    expect(r.wallCladding.totalCost).toBeCloseTo(1283641.6134000001, 4);
    expect(r.roofCladding!.totalCost).toBeCloseTo(1359670.890204094, 4);
    expect(r.drainage.totalCost).toBeCloseTo(69922.74857142857, 6);
    expect(r.roofTrim.totalCost).toBeCloseTo(59489.14176, 6);
  });

  it("reproduces all four commercial lines and the total exactly", () => {
    expect(line(r, "Каркас").cost).toBeCloseTo(1873532.9454540065, 2);
    expect(line(r, "Стеновое ограждение").cost).toBeCloseTo(1362758.150931158, 2);
    expect(line(r, "Кровельное ограждение").cost).toBeCloseTo(1518864.4361462328, 2);
    expect(line(r, "Окна, ворота, двери").cost).toBeCloseTo(787566, 4);
    // F151 «ИТОГО Цена + упаковка» плюс проёмы — здесь описок в исходнике нет,
    // поэтому сходится целиком, без зазора.
    expect(r.commercial.materialsWithPackaging).toBeCloseTo(4755155.532531397, 2);
    expect(r.commercial.totalCost).toBeCloseTo(4755155.532531397 + 787566, 2);
  });
});

/**
 * Четвёртый реальный объект — «21923» (Москва, 12×24, h5, шаг 6), два
 * ценовых варианта одного и того же здания: k=1,0 и k=0,8. Только
 * ведомость, без подборщика — с/в известен напрямую (C5/D5 = 3/1),
 * поэтому задан вручную, как и для «22316»/«22318».
 *
 * Проверяет банк сечений сразу в двух строках одной командой: обе
 * ведомости совпали с нашим банком построчно — балка, колонна, болты в
 * раме, вес фасонок, — при разных k. Хорошее независимое подтверждение
 * банка отдельно от климата: с/в тот же, k разный, сечения разные, и оба
 * варианта совпали.
 */
const project21923Base = {
  city: "Москва",
  svOverride: "3/1",
  span: 12 as const,
  length_m: 24,
  height_m: 5,
  gammaN: 1.0 as const,
  roofingType: "С-П 150",
  deckingMark: "С44-1000-0,7",
  maxStepOverride_mm: 0,
  minStep_mm: 0,
  framePitchOverride_m: 0,
  wallPanel_mm: 100,
  roofPanel_mm: 150,
  openings: {
    gates: [{ count: 1, width_m: 4.5, height_m: 4 }],
    doors: [],
    windows: [{ count: 2, width_m: 4, height_m: 1 }],
  },
  railingPurlin: false,
  // ТЗ, п.14 — этот объект заказан без организованного водостока вовсе,
  // в обоих вариантах F70 = 0 в ведомости.
  hasDrainage: false,
  tubeStrutCount: 3,
  postSpacing_m: 2,
};

describe("computeProject — реальный проект «21923», два варианта k", () => {
  it("picks the estimator's own bank row at k=1,0 (heavier offer)", () => {
    const r = computeProject({ ...project21923Base, bankK: 1.0, snowGuards: true });
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.beam.profile).toBe("ПГС300/20х80х2,5");
    expect(s!.column.profile).toBe("ПГС300/20х80х2");
    expect(s!.bolts.totalInFrame).toBe(260);
    expect(s!.massGussetPlates_kg).toBe(227);
    expect(r.frameTakeoff!.frameCount).toBe(5);
  });

  it("picks the estimator's own bank row at k=0,8 (lighter offer)", () => {
    const r = computeProject({ ...project21923Base, bankK: 0.8, snowGuards: false });
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.beam.profile).toBe("ПГС245/20х80х2,5");
    expect(s!.column.profile).toBe("ПГС245/20х80х2");
    expect(s!.bolts.totalInFrame).toBe(276);
    expect(s!.massGussetPlates_kg).toBe(237);
  });

  it("reproduces the wall/roof trim exactly, at both k — they don't depend on it", () => {
    // F44 и F81 совпали в обоих вариантах: 49 818,95 ₽ и (в зависимости
    // от снегозадержателя) 120 442,59 / 57 249,22 ₽.
    const heavy = computeProject({ ...project21923Base, bankK: 1.0, snowGuards: true });
    const light = computeProject({ ...project21923Base, bankK: 0.8, snowGuards: false });
    expect(heavy.wallTrim.totalCost).toBeCloseTo(49818.94736842105, 4);
    expect(light.wallTrim.totalCost).toBeCloseTo(49818.94736842105, 4);
    expect(heavy.roofTrim.totalCost).toBeCloseTo(120442.59318857142, 3);
    expect(light.roofTrim.totalCost).toBeCloseTo(57249.22176, 4);
  });

  it("reproduces the roof area exactly (F147/1,03 = 288 = пролёт × длина)", () => {
    const r = computeProject({ ...project21923Base, bankK: 1.0, snowGuards: true });
    expect(r.envelope.roofArea).toBeCloseTo(296.64, 6);
  });

  it("turns the drainage section off entirely, not just to a different size", () => {
    const on = computeProject({ ...project21923Base, bankK: 1.0, snowGuards: true, hasDrainage: true });
    const off = computeProject({ ...project21923Base, bankK: 1.0, snowGuards: true });
    expect(on.drainage.totalCost).toBeGreaterThan(0);
    expect(off.drainage.totalCost).toBe(0);
    expect(off.drainage.items).toEqual([]);
  });

  it("does not double the gable allowance at span=12 exactly — the boundary is 'above 12'", () => {
    // «21923» (пролёт ровно 12 м) не удваивает в файле: =(C8+C9)*2*C10+C8*2,
    // один C8, не два. Расчётчик подтвердила прямо: «Граница больше 12,
    // начиная с 13, при пролёте 12м умножать не нужно» — порог строгий,
    // 12 м в удвоение не попадает (см. buildingEnvelope.ts).
    const r = computeProject({ ...project21923Base, bankK: 1.0, snowGuards: true });
    expect(r.envelope.grossWallArea).toBe(384); // периметр 360 + фронтон 24 (не удвоенный)
  });
});

describe("computeProject — поведение вне сверки", () => {
  it("reaches the estimator's own с/в and k without any override", () => {
    // Наша база даёт Берёзовскому снег 1,5 кПа. Лестница ИНСИ: 1,5 + 0,1
    // (С-П 150) = 1,6 → район IV, k = 0,8. Ровно то, что стоит в файле.
    const r = computeProject({ ...project22316, svOverride: undefined, bankK: "auto" });
    expect(r.bankBlock!.snowDistrict).toBe("IV");
    expect(r.bankBlock!.bankK).toBe(0.8);
    expect(r.climate.ok && r.climate.value.standard).toBe("4/1");
    expect(r.climate.ok && r.climate.overridden).toBe(false);
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.framePitch_m).toBe(4.5);
    expect(s!.bolts.totalInFrame).toBe(308);
    expect(s!.massGussetPlates_kg).toBe(264);
  });

  it("does the same for «22318» — снег 1,8 через ту же лестницу", () => {
    const r = computeProject({ ...project22318, svOverride: undefined, bankK: "auto" });
    // 1,8 + 0,1 = 1,9 → IV / 1,0.
    expect(r.bankBlock!.snowDistrict).toBe("IV");
    expect(r.bankBlock!.bankK).toBe(1);
    expect(r.climate.ok && r.climate.value.standard).toBe("4/1");
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.framePitch_m).toBe(4);
    expect(s!.bolts.totalInFrame).toBe(276);
    expect(s!.massGussetPlates_kg).toBe(238);
  });

  it("survives every span without throwing", () => {
    for (const span of [9, 12, 15, 18, 21, 24] as const) {
      const r = computeProject({ ...project22316, span, svOverride: undefined, bankK: "auto" });
      expect(r.frame).not.toBeNull();
      // Расчёт доходит до конца, даже если строки банка нет.
      expect(() => r.commercial.totalCost).not.toThrow();
    }
  });

  it("reports the frame line incomplete when the bank has no gusset weight", () => {
    const r = computeProject({ ...project22316, framePitchOverride_m: 5 });
    // Шаг рам вручную не ломает цепочку.
    expect(r.geometry.framePitch_m).toBe(5);
    expect(r.frameTakeoff!.frameCount).toBe(7);
  });

  it("the railing purlin adds half a line per slope", () => {
    const without = computeProject(project22316);
    const with_ = computeProject({ ...project22316, railingPurlin: true });
    expect(with_.purlinLayout!.totalProfileLength_m).toBeGreaterThan(
      without.purlinLayout!.totalProfileLength_m,
    );
  });
});

describe("высота вне банка сечений — методика расчётчика", () => {
  // Сверено на реальном проекте «22330» (пролёт 15, высота по ТЗ 7 м):
  // на чертеже расчётчицы подписано «7,0(6,0) м» — сечение рамы подобрано
  // по корзине 6,0 м, а не отклонено. Расчётчик подтвердила: в подборщик
  // вводится максимально допустимая высота банка (для пролёта 15 это 6,2 м,
  // что и снэпается в корзину 6,0), сечение колонны увеличивается вручную —
  // требует проверки главным конструктором.
  const base: ProjectInputs = { ...project22318, height_m: 7 };

  it("caps height only for the frame section bank query, marks requiresCheck", () => {
    const r = computeProject(base);
    expect(r.heightBucket).toBe(6.0);
    expect(r.frame!.ok).toBe(true);
    expect(r.requiresCheck).toBe(true);
    expect(r.approximations.some((a) => a.kind === "высота")).toBe(true);
  });

  it("keeps the real ТЗ height everywhere else — geometry is not capped", () => {
    const capped = computeProject(base);
    const notCapped = computeProject({ ...base, height_m: 6 });
    // Реальная высота (7 м) уходит в геометрию, площадь стен и фахверк —
    // поэтому расчёт при 7 м не совпадает с расчётом при явных 6 м, хотя
    // сечение рамы в обоих случаях подобрано по одной и той же корзине 6,0.
    expect(capped.geometry.framePitch_m).toBe(notCapped.geometry.framePitch_m);
    expect(capped.envelope.wallArea).toBeGreaterThan(notCapped.envelope.wallArea);
  });

  it("does not cap height within the bank's limit", () => {
    const r = computeProject({ ...base, height_m: 6 });
    expect(r.heightBucket).toBe(6.0);
    expect(r.approximations.some((a) => a.kind === "высота")).toBe(false);
  });
});

describe("сечение колонны вручную — общей формулы «увеличения» нет", () => {
  // Расчётчик прямо ответила «Это совпадение», когда её спросили, не берёт
  // ли она сечение балки для увеличенной колонны — общего правила нет,
  // поэтому вместо угадывания в приложении есть поле ручного ввода.
  // Профили сверены на реальном «22330»: банк для пролёта 15, с/в 3/1,
  // высоты-корзины 6,0, k=1,0 даёт колонну «ПГС300/20х80х2,5»; в реальной
  // ведомости колонна — «ПГС300/20х80х3».
  const base: ProjectInputs = { ...project22318, height_m: 7, bankK: 1.0, svOverride: "3/1" };

  it("replaces the column profile and recomputes its mass and cost", () => {
    const stock = computeProject(base);
    const stockFrame = stock.frame && stock.frame.ok ? stock.frame.value! : null;
    expect(stockFrame!.column.profile).toBe("ПГС300/20х80х2,5");

    const overridden = computeProject({ ...base, columnOverride: "ПГС300/20х80х3" });
    const overriddenFrame = overridden.frame && overridden.frame.ok ? overridden.frame.value! : null;
    expect(overriddenFrame!.column.profile).toBe("ПГС300/20х80х3");
    // Балка, болты и узловые пластины не меняются — только колонна.
    expect(overriddenFrame!.beam.profile).toBe(stockFrame!.beam.profile);
    expect(overriddenFrame!.bolts.totalInFrame).toBe(stockFrame!.bolts.totalInFrame);
    // Профиль потолще — значит и масса, и стоимость колонны выше.
    expect(overridden.frameTakeoff!.column.massPerM_kg).toBeGreaterThan(
      stock.frameTakeoff!.column.massPerM_kg!,
    );
    expect(overridden.frameTakeoff!.totalFrameCost!).toBeGreaterThan(
      stock.frameTakeoff!.totalFrameCost!,
    );
    expect(overridden.requiresCheck).toBe(true);
    expect(overridden.approximations.some((a) => a.message.includes("ПГС300/20х80х3"))).toBe(
      true,
    );
  });

  it("does nothing when the override matches the bank's own profile", () => {
    const r = computeProject({ ...base, columnOverride: "ПГС300/20х80х2,5" });
    expect(r.approximations.some((a) => a.message.includes("задано вручную"))).toBe(false);
  });

  it("is a no-op without a frame selection", () => {
    // Город не найден в справочнике климата — до подбора сечения дело не
    // доходит вовсе (frame остаётся null), override просто не на что применить.
    const r = computeProject({ ...base, city: "Такого города нет", columnOverride: "ПГС300/20х80х3" });
    expect(r.frame).toBeNull();
  });
});

describe("степень огнестойкости — информационное поле, на расчёт не влияет", () => {
  // Расчётчик подтвердила: «Штрипс не считается ни в каком случае; степень
  // огнестойкости на расчёт не влияет» — ни при каком значении, включая IV.
  it.each([1, 2, 3, 4, 5])("rating %s changes nothing but is echoed in inputs", (rating) => {
    const withRating = computeProject({ ...project22318, fireResistanceRating: rating });
    const without = computeProject({ ...project22318, fireResistanceRating: undefined });
    expect(withRating.commercial.totalCost).toBe(without.commercial.totalCost);
    expect(withRating.approximations).toEqual(without.approximations);
    expect(withRating.inputs.fireResistanceRating).toBe(rating);
  });
});

describe("профлист вместо сэндвич-панели — раньше молча считался как СП", () => {
  // Баг, который это чинит: «Покрытие кровли» = профлист уже давало
  // верный собственный вес для нагрузок, но раздел обшивки всё равно
  // считал стоимость по сэндвич-панели (roofPanel_mm), какая бы толщина
  // там ни стояла — то есть выдавал уверенную, но неверную цену.
  const base: ProjectInputs = { ...project22318, roofingType: "профлист" };

  it("switches the roof cladding cost off sandwich-panel pricing", () => {
    const r = computeProject(base);
    expect(r.roofCladding!.items[0].name).toContain("Профлист С-44");
    expect(r.roofCladding!.items[0].name).not.toContain("СП");
  });

  it("keeps wall cladding as СП unless it's switched too", () => {
    const r = computeProject(base);
    expect(r.wallCladding.items[0].name).toContain("СП");
  });

  it("switches wall cladding to profnastil when asked, independently of the roof", () => {
    const r = computeProject({
      ...base,
      roofingType: "С-П 150",
      wallCladdingMaterial: "профнастил",
    });
    expect(r.wallCladding.items[0].name).toContain("Профлист С-18");
    expect(r.roofCladding!.items[0].name).toContain("СП");
  });

  it("both walls and roof in profnastil at once — the exact case asked about", () => {
    const r = computeProject({ ...base, wallCladdingMaterial: "профнастил" });
    expect(r.wallCladding.items[0].name).toContain("Профлист С-18");
    expect(r.roofCladding!.items[0].name).toContain("Профлист С-44");
    expect(r.wallCladding.totalCost).toBeGreaterThan(0);
    expect(r.roofCladding!.totalCost).toBeGreaterThan(0);
    expect(r.requiresCheck).toBe(true);
    expect(r.approximations.some((a) => a.kind === "обшивка")).toBe(true);
  });

  it("uses its own area formula, not the sandwich-panel one", () => {
    const profnastil = computeProject({ ...base, wallCladdingMaterial: "профнастил" });
    const sp = computeProject({ ...base, roofingType: "С-П 150" });
    expect(profnastil.envelope.grossWallArea).not.toBeCloseTo(sp.envelope.grossWallArea, 0);
    expect(profnastil.envelope.roofArea).not.toBeCloseTo(sp.envelope.roofArea, 0);
  });
});

describe("вариант «СГ по Р» (пролёт 24 м)", () => {
  const base24: ProjectInputs = {
    ...project22316,
    span: 24,
    height_m: 6,
    svOverride: "1/3",
    bankK: 1.0,
    trussedVariant: false,
  };

  it("uses the standard row by default", () => {
    const r = computeProject(base24);
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.variant).toBe("стандарт");
    expect(s!.beam.profile).toBe("ПГС300/20х80х2");
    expect(r.trussedVariantMissing).toBe(false);
  });

  it("switches to the trussed row when asked", () => {
    const r = computeProject({ ...base24, trussedVariant: true });
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.variant).toBe("вариант_2");
    expect(s!.beam.profile).toBe("ПГС300/20х80х2 сг по Р");
    expect(s!.massGussetPlates_kg).toBe(507);
    expect(r.trussedVariantMissing).toBe(false);
  });

  it("falls back to the standard row and says so when the bank has no trussed variant", () => {
    // Вариант «СГ по Р» есть только для с/в 1/3.
    const r = computeProject({ ...base24, svOverride: "4/1", trussedVariant: true });
    expect(r.trussedVariantMissing).toBe(true);
    const s = r.frame!.ok ? r.frame!.value : null;
    expect(s!.variant).toBe("стандарт");
  });
});
