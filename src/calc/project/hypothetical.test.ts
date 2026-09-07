import { describe, expect, it } from "vitest";
import { buildBill } from "../bill/buildBill";
import { computeProject, type ProjectInputs } from "./computeProject";

/**
 * Сверка с ЧУЖИМ оракулом — с самими файлами, а не с их прочтением.
 *
 * «22316» и «22318» доказывают только то, что формулы сняты верно: по ним
 * они и снимались. Чтобы проверить, что правила обобщаются, было построено
 * четыре выдуманных расчёта: в копиях подборщика и ведомости менялись
 * исходные данные, книги пересчитывались LibreOffice (calculateAll), и те
 * же данные прогонялись через computeProject + buildBill.
 *
 * Сошлось всё: с/в, снеговой район и блок банка, шаг рам, максимальный и
 * подобранный шаг прогонов, сечения балки/колонны/прогона, болты в раме,
 * вес фасонок, масса прогонов — и каждый итог ведомости до копейки.
 * Ожидаемые числа ниже сняты с пересчитанных книг, а не с приложения.
 *
 * Как повторить — scripts/oracle/README.md.
 *
 * Замеченное по дороге: ячейка J14 ведомости жёстко хранит уклон 15°,
 * тогда как подборщик считает =ЕСЛИ(пролёт>21;6;15). На случае «C»
 * (пролёт 24 м) шаблон расходится с подборщиком, и мы идём за
 * подборщиком; в оракуле J14 правится под то же правило.
 */

const base: Omit<ProjectInputs, "city" | "span" | "length_m" | "height_m"> = {
  gammaN: 1.0,
  bankK: "auto",
  roofingType: "С-П 200",
  deckingMark: "С44-1000-0,7",
  maxStepOverride_mm: 0,
  minStep_mm: 0,
  framePitchOverride_m: 0,
  wallPanel_mm: 120,
  roofPanel_mm: 200,
  openings: {
    gatesCount: 0, gateWidth_m: 0, gateHeight_m: 0,
    doorsCount: 0, doorWidth_m: 0, doorHeight_m: 0,
    windowsCount: 0, windowWidth_m: 0, windowHeight_m: 0,
  },
  snowGuards: false,
  railingPurlin: false,
  tubeStrutCount: 3,
  postSpacing_m: 2,
};

interface Oracle {
  /** Что выдал пересчитанный подборщик (лист «вывод»). */
  engine: {
    sv: string; framePitch_m: number; maxPurlinStep_mm: number; purlinStep_mm: number;
    beam: string; column: string; purlin: string;
    boltsInFrame: number; gussetPerFrame_kg: number; purlinMass_kg: number;
  };
  /** Итоги пересчитанной ведомости (лист «12м»). */
  bill: Record<string, number>;
}

const cases: { name: string; inputs: ProjectInputs; oracle: Oracle }[] = [
  {
    name: "A · Тюмень, 21×36, h6 — ленточное окно, ворота и двери",
    inputs: {
      ...base,
      city: "Тюмень", span: 21, length_m: 36, height_m: 6,
      openings: {
        gatesCount: 2, gateWidth_m: 4, gateHeight_m: 4.2,
        doorsCount: 2, doorWidth_m: 1, doorHeight_m: 2.1,
        windowsCount: 1, windowWidth_m: 24, windowHeight_m: 1.5,
      },
      // Обрамление проёмов приложение выводит само, но перемычки окон
      // подборщик считает у себя — здесь берём его число (вывод!E68).
      extraTubeMass_t: 1.41163701,
    },
    oracle: {
      engine: {
        sv: "4/1", framePitch_m: 3, maxPurlinStep_mm: 2100, purlinStep_mm: 2100,
        beam: "ПГС300/20х80х3", column: "ПГС245/20х80х2,5", purlin: "2ПС 145х45х1,5",
        boltsInFrame: 332, gussetPerFrame_kg: 309, purlinMass_kg: 2548.8,
      },
      bill: {
        F32: 2278417.97171918,
        F44: 74728.4210526316,
        F70: 122200.662857143,
        F81: 86626.59264,
        F100: 1753896.54801608,
        F114: 2280572.06328,
        F147: 3159381.3142286,
        F82: 2561973.64826895,
        F148: 7193849.92552468,
        F149: 9755823.57379363,
        F151: 9950940.04526951,
        F154: 64579.9304277977,
      },
    },
  },
  {
    name: "B · Курган, 15×42, h4,5, γn=0,8 — со снегозадержанием",
    inputs: {
      ...base,
      city: "Курган", span: 15, length_m: 42, height_m: 4.5,
      gammaN: 0.8, roofingType: "С-П 150", wallPanel_mm: 100, roofPanel_mm: 150,
      snowGuards: true,
      openings: {
        gatesCount: 2, gateWidth_m: 3.5, gateHeight_m: 3.5,
        doorsCount: 1, doorWidth_m: 1, doorHeight_m: 2,
        windowsCount: 0, windowWidth_m: 0, windowHeight_m: 0,
      },
    },
    oracle: {
      engine: {
        sv: "3/2", framePitch_m: 6, maxPurlinStep_mm: 2300, purlinStep_mm: 2065,
        beam: "ПГС300/20х80х2,5", column: "ПГС300/20х80х2", purlin: "2ПС 245х65х1,5",
        boltsInFrame: 300, gussetPerFrame_kg: 264, purlinMass_kg: 4245.78,
      },
      bill: {
        F32: 1423403.80668675,
        F44: 74728.4210526316,
        F70: 124658.28,
        F81: 205918.31808,
        F100: 1031454.92931911,
        F114: 1623954.4899,
        F147: 2379424.05785716,
        F82: 1828708.82581938,
        F148: 5034833.47707627,
        F149: 6863542.30289565,
        F151: 7000813.14895356,
        F154: 43976.981561892,
      },
    },
  },
  {
    name: "C · Новосибирск, 24×30, h7 — уклон 6°, прогон под ограждение, 2ТПС",
    inputs: {
      ...base,
      city: "Новосибирск", span: 24, length_m: 30, height_m: 7,
      roofingType: "наше 150 мм", wallPanel_mm: 150, roofPanel_mm: 150,
      railingPurlin: true,
      openings: {
        gatesCount: 1, gateWidth_m: 6, gateHeight_m: 5,
        doorsCount: 2, doorWidth_m: 1, doorHeight_m: 2,
        windowsCount: 1, windowWidth_m: 30, windowHeight_m: 1.2,
      },
      extraTubeMass_t: 1.1015919936,
    },
    oracle: {
      engine: {
        sv: "4/3", framePitch_m: 3.75, maxPurlinStep_mm: 2050, purlinStep_mm: 2025,
        beam: "ПГС300/20х80х3", column: "ПГС300/20х80х2,5", purlin: "2ТПС 150х45х2",
        boltsInFrame: 288, gussetPerFrame_kg: 526, purlinMass_kg: 3237.3,
      },
      bill: {
        F32: 2046960.90274972,
        F44: 71292.6315789474,
        F70: 116652.445714286,
        F81: 77911.0272,
        F100: 1647381.84694492,
        F114: 2665908.32832,
        F147: 2703536.66010626,
        F82: 2312817.00724295,
        F148: 7016826.83537118,
        F149: 9329643.84261413,
        F151: 9516236.71946641,
        F154: 62213.8301049993,
      },
    },
  },
  {
    name: "D · Омск, 12×24, h4 — маленький ангар без окон",
    inputs: {
      ...base,
      city: "Омск", span: 12, length_m: 24, height_m: 4,
      roofingType: "С-П 100", wallPanel_mm: 80, roofPanel_mm: 100,
      openings: {
        gatesCount: 1, gateWidth_m: 4, gateHeight_m: 4,
        doorsCount: 1, doorWidth_m: 1, doorHeight_m: 2,
        windowsCount: 0, windowWidth_m: 0, windowHeight_m: 0,
      },
    },
    oracle: {
      engine: {
        sv: "3/2", framePitch_m: 6, maxPurlinStep_mm: 2300, purlinStep_mm: 1640,
        beam: "ПГС300/20х80х2,5", column: "ПГС245/20х80х2", purlin: "2ПС 245х65х1,5",
        boltsInFrame: 276, gussetPerFrame_kg: 233, purlinMass_kg: 2205.6,
      },
      bill: {
        F32: 735161.878863373,
        F44: 48101.052631579,
        F70: 66832.1485714286,
        F81: 57249.22176,
        F100: 633885.37408359,
        F114: 902370.0708,
        F147: 978020.289763275,
        F82: 907344.301826381,
        F148: 2514275.73464687,
        F149: 3421620.03647325,
        F151: 3490052.43720271,
        F154: 21106.3749079761,
      },
    },
  },
];

for (const { name, inputs, oracle } of cases) {
  describe(`выдуманный расчёт «${name}»`, () => {
    const project = computeProject(inputs);
    const bill = buildBill(project);

    it("повторяет цепочку подбора подборщика", () => {
      const climate = project.climate;
      const selection = project.frame;
      if (!climate.ok) throw new Error(`климат не определился: ${climate.error}`);
      if (!selection?.ok || !selection.value) throw new Error("сечения не подобрались");
      const frame = selection.value;
      const e = oracle.engine;
      expect(climate.value.standard).toBe(e.sv);
      expect(project.geometry.framePitch_m).toBe(e.framePitch_m);
      expect(project.maxPurlinStep).toBe(e.maxPurlinStep_mm);
      expect(project.purlin?.step_mm).toBe(e.purlinStep_mm);
      expect(frame.beam.profile).toBe(e.beam);
      expect(frame.column.profile).toBe(e.column);
      expect(project.purlin?.profile.name).toBe(e.purlin);
      expect(frame.bolts.totalInFrame).toBe(e.boltsInFrame);
      expect(frame.massGussetPlates_kg).toBe(e.gussetPerFrame_kg);
      // Масса прогонов замыкает число линий: подборщик считает её сам.
      expect(project.purlinLayout?.totalMass_kg).toBeCloseTo(e.purlinMass_kg, 6);
    });

    it("повторяет каждый итог пересчитанной ведомости", () => {
      const totals: Record<string, number | null> = {};
      for (const s of [...bill.materials, ...bill.additional]) totals[s.sourceCell] = s.totalCost;
      totals.F82 = bill.materialsTotal;
      totals.F148 = bill.additionalTotal;
      totals.F149 = bill.recommendedPrice;
      totals.F151 = bill.totalWithPackaging;
      totals.F154 = bill.buildingMass_kg;
      for (const [cell, expected] of Object.entries(oracle.bill)) {
        expect(totals[cell], cell).toBeCloseTo(expected, 6);
      }
    });
  });
}
