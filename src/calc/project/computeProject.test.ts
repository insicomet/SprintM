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
    gatesCount: 1,
    gateWidth_m: 4,
    gateHeight_m: 4.2,
    doorsCount: 1,
    doorWidth_m: 1,
    doorHeight_m: 2,
    windowsCount: 1,
    windowWidth_m: 30,
    windowHeight_m: 1,
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
    gatesCount: 2,
    gateWidth_m: 3,
    gateHeight_m: 3,
    doorsCount: 1,
    doorWidth_m: 1,
    doorHeight_m: 2,
    windowsCount: 0,
    windowWidth_m: 0,
    windowHeight_m: 0,
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
