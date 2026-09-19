import { describe, expect, it } from "vitest";
import { selectGirtProfile } from "./selectGirt";
import { areaReductionCoeff, girtWindPressure_kPa, kZe, zetaZe, zoneWindPressure_kPa } from "./windLoad";

/**
 * «Благовещенск» — единственный полный живой пример из «Калькулятор
 * ограждайки v1.5.xlsx», который удалось прочитать целиком (24×24×10,5,
 * тип местности «В», γn=0,8, профлист без утепления, шаг стоек 6 м,
 * высота профиля зажата на 145 мм).
 */
const blagoveshchensk = {
  wallHeight_m: 9.3,
  buildingHeight_m: 10.5,
  postStep_m: 6,
  w0_kPa: 0.3,
  terrain: "В" as const,
  gammaN: 0.8,
  insulationThickness_mm: 0,
  maxStep_mm: 1500,
  minProfileHeight_mm: 145,
  maxProfileHeight_mm: 145,
};

describe("windLoad — «Ветер по СП»", () => {
  it("reproduces the live cells C11/C12/F7/G7 for Благовещенск (h=10.5, В, wo=0,3)", () => {
    expect(kZe(10.5, "В")).toBeCloseTo(0.66, 10);
    expect(zetaZe(10.5, "В")).toBeCloseTo(1.053, 10);
    expect(zoneWindPressure_kPa(0.3, 10.5, "В", "corner")).toBeCloseTo(1.25200152, 8);
    expect(zoneWindPressure_kPa(0.3, 10.5, "В", "typical")).toBeCloseTo(0.79672824, 8);
  });

  it("reproduces the live moment at step=1370mm (M=q*L^2/8, 'Расчет Угловая'!AD6 for угловая)", () => {
    const pressure = girtWindPressure_kPa(0.3, 10.5, "В", "corner", 1.37, 6, 0.8);
    const moment = pressure * 1.37 * 6 * 6 / 8;
    expect(moment).toBeCloseTo(4.939897197312002, 9);
  });

  it("area-reduction coefficient matches 'Ветер по СП'!V5:AD6 at the breakpoints", () => {
    expect(areaReductionCoeff(0)).toBe(1);
    expect(areaReductionCoeff(4)).toBeCloseTo(0.9, 10);
    expect(areaReductionCoeff(8.22)).toBeCloseTo(0.8, 10);
    expect(areaReductionCoeff(20)).toBeCloseTo(0.65, 10);
    expect(areaReductionCoeff(100)).toBeCloseTo(0.65, 10); // за пределами таблицы — последняя точка
  });
});

describe("selectGirtProfile — сверка с «Благовещенск» (реальная ведомость)", () => {
  it("picks the exact real profile/rows/brackets/mass for the угловая zone", () => {
    const result = selectGirtProfile({ ...blagoveshchensk, zoneKind: "corner", zoneLength_m: 12 });
    expect(result).not.toBeNull();
    expect(result!.profile.name).toBe("[]ПП 145х45х1,5");
    expect(result!.zone.rows).toBe(7);
    expect(result!.zone.brackets).toBe(14);
    expect(result!.zone.bracketWeight_kg).toBeCloseTo(21, 9);
    expect(result!.zone.profileMass_kg).toBeCloseTo(448.8288, 4);
    expect(result!.utilization).toBeLessThanOrEqual(1);
  });

  it("picks the exact real profile/rows/brackets/mass for the рядовая zone", () => {
    const result = selectGirtProfile({ ...blagoveshchensk, zoneKind: "typical", zoneLength_m: 12 });
    expect(result).not.toBeNull();
    expect(result!.profile.name).toBe("[]ПП 145х45х1,2");
    expect(result!.zone.rows).toBe(7);
    expect(result!.zone.brackets).toBe(14);
    expect(result!.zone.bracketWeight_kg).toBeCloseTo(21, 9);
    expect(result!.zone.profileMass_kg).toBeCloseTo(359.1504, 4);
    expect(result!.utilization).toBeLessThanOrEqual(1);
  });

  it("returns null when nothing in range passes the moment check", () => {
    const result = selectGirtProfile({
      ...blagoveshchensk,
      zoneKind: "corner",
      zoneLength_m: 12,
      minProfileHeight_mm: 1,
      maxProfileHeight_mm: 1, // высот 1мм в каталоге нет вовсе
    });
    expect(result).toBeNull();
  });
});
