import { describe, expect, it } from "vitest";
import { buildBill } from "./buildBill";
import { computeProject, type ProjectInputs } from "../project/computeProject";

const project22316: ProjectInputs = {
  city: "Берёзовский, Свердловская область",
  span: 18,
  length_m: 30,
  height_m: 5,
  gammaN: 1.0,
  bankK: "auto",
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
  // Расчётчик вписывает это слагаемое в C96 округлённым до трёх знаков.
  // Само число приложение теперь выводит само (обрамление проёмов,
  // вывод!E68 = 0,43176) — здесь ставим его округление, чтобы итог сошёлся
  // с файлом до копейки; разница округления — 33 ₽ на разделе.
  extraTubeMass_t: 0.432,
  postSpacing_m: 2,
};

const project22318: ProjectInputs = {
  ...project22316,
  city: "Сургут",
  span: 15,
  length_m: 24,
  snowLoadOverride_kPa: 1.8,
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
  strutTube: "60х3",
  extraTubeMass_t: 0.795, // округление расчётчика от 0,79548
};

function totals(bill: ReturnType<typeof buildBill>) {
  return Object.fromEntries(
    [...bill.materials, ...bill.additional].map((s) => [s.sourceCell, s.totalCost]),
  );
}

describe("buildBill — «22316»", () => {
  const bill = buildBill(computeProject(project22316));

  it("reproduces every section total of the bill", () => {
    const t = totals(bill);
    expect(t["F32"]).toBeCloseTo(1499709.303380665, 2); // Итого каркас
    expect(t["F44"]).toBeCloseTo(62703.15789473685, 2); // Итого стены
    expect(t["F70"]).toBeCloseTo(92971.10571428572, 2); // ИТОГО водосток
    expect(t["F81"]).toBeCloseTo(151676.2614857143, 2); // Итого кровля
    expect(t["F100"]).toBeCloseTo(1053876.2881239487, 2); // Итого каркас (доп.)
    expect(t["F147"]).toBeCloseTo(2039506.3353061413, 2); // Итого кровля (доп.)
  });

  it("splits the fasteners the way the bill does", () => {
    // Фс11/Фс14 и Фс12 идут в первом «Каркасе» (строки 29–30), остальной
    // крепёж — во втором (85–95).
    const first = bill.materials[0].rows.map((r) => r.name);
    expect(first).toContain("Фс11, Фс14");
    expect(first).toContain("Фс12");
    const second = bill.additional[0].rows.map((r) => r.name);
    expect(second).not.toContain("Фс12");
    expect(second).toContain("Болт М16х50");
    expect(second).toContain("Конструкции из труб");
  });

  it("keeps the purlin line in metres of profile, as the bill writes it", () => {
    const purlin = bill.materials[0].rows.find((r) => r.name.startsWith("ПС 200х65"))!;
    expect(purlin.count).toBeCloseTo(780, 9);
    expect(purlin.cost).toBeCloseTo(448500, 6);
    expect(purlin.unitPrice).toBeCloseTo(575, 9);
  });

  it("carries 2% overhead in every section", () => {
    for (const s of [...bill.materials, ...bill.additional]) {
      if (s.subtotalCost === null) continue;
      expect(s.overheadCost).toBeCloseTo(s.subtotalCost * 0.02, 6);
      expect(s.totalCost).toBeCloseTo(s.subtotalCost * 1.02, 6);
    }
  });

  it("adds up to the bill's own bottom line, packaging included", () => {
    // F148 = 4 595 638,95; F149 = 6 402 698,78; F151 = 6 530 752,75.
    // Стеновая обшивка у нас на 0,8 м² меньше — см. описку с воротами,
    // поэтому сверяем с этим зазором.
    expect(bill.materialsTotal).toBeCloseTo(1807059.828, 2);
    expect(bill.totalWithPackaging).toBeGreaterThan(6528000);
    expect(bill.totalWithPackaging).toBeLessThan(6531000);
  });

  it("reports the building mass in the same ballpark as the bill's 41 198 кг", () => {
    expect(bill.buildingMass_kg).toBeGreaterThan(38000);
    expect(bill.buildingMass_kg).toBeLessThan(44000);
  });
});

describe("buildBill — «22318»", () => {
  const bill = buildBill(computeProject(project22318));

  it("reproduces every section total of the bill", () => {
    const t = totals(bill);
    expect(t["F32"]).toBeCloseTo(1020158.6720137318, 2);
    expect(t["F44"]).toBeCloseTo(52395.78947368421, 2);
    expect(t["F70"]).toBeCloseTo(69922.74857142857, 2);
    expect(t["F81"]).toBeCloseTo(59489.14176, 2);
    expect(t["F100"]).toBeCloseTo(816638.3288764771, 2);
    expect(t["F114"]).toBeCloseTo(1283641.6134000001, 2);
    expect(t["F147"]).toBeCloseTo(1359670.890204094, 2);
  });

  it("matches «ИТОГО Цена + упаковка» (F151) exactly", () => {
    expect(bill.totalWithPackaging).toBeCloseTo(4755155.532531397, 2);
  });
});
