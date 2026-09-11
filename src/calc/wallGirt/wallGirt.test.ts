import { describe, expect, it } from "vitest";
import { computeGirtZone, computeWallGirtSection, computeWallGirtWallType } from "./wallGirt";
import { getGirtProfileOptions, pairedGirtProfile } from "./catalog";
import type { GirtZoneInput } from "./types";

const single = getGirtProfileOptions().find((o) => o.name === "ПС 145х45х1,5")!;
const paired = pairedGirtProfile(single);

describe("computeGirtZone — ряды (Лист1!F49/F50)", () => {
  it("одинарная схема: +1 к округлённому вверх числу шагов", () => {
    const zone = computeGirtZone({
      zoneKind: "typical",
      zoneLength_m: 6,
      wallHeight_m: 3,
      postStep_m: 6,
      stepRigel_mm: 1000,
      profile: single,
      paired: false,
    });
    // 3000/1000 = 3, +1 (одинарная схема) = 4
    expect(zone.rows).toBe(4);
  });

  it("спаренная схема: без добавки", () => {
    const zone = computeGirtZone({
      zoneKind: "typical",
      zoneLength_m: 6,
      wallHeight_m: 3.1,
      postStep_m: 6,
      stepRigel_mm: 1000,
      profile: paired,
      paired: true,
    });
    // ОКРУГЛВВЕРХ(3100/1000) = 4, +0 (спаренная схема) = 4
    expect(zone.rows).toBe(4);
  });
});

describe("computeGirtZone — кронштейны (Лист1!G49/G50)", () => {
  const base: Omit<GirtZoneInput, "zoneKind"> = {
    zoneLength_m: 12,
    wallHeight_m: 3,
    postStep_m: 6,
    stepRigel_mm: 1000,
    profile: single,
    paired: false,
  };

  it("угловая зона — без округления (буквально формула файла)", () => {
    const zone = computeGirtZone({ ...base, zoneKind: "corner" });
    // ряды=4, 4×12/6 = 8 ровно
    expect(zone.rows).toBe(4);
    expect(zone.brackets).toBe(8);
  });

  it("угловая зона — дробное число кронштейнов, когда протяжённость не кратна шагу стоек", () => {
    const zone = computeGirtZone({ ...base, zoneKind: "corner", zoneLength_m: 10 });
    // 4×10/6 = 6,666...
    expect(zone.brackets).toBeCloseTo((4 * 10) / 6, 9);
  });

  it("рядовая зона — ОКРУГЛ(протяж./шаг,1) затем ОКРУГЛВВЕРХ", () => {
    const zone = computeGirtZone({ ...base, zoneKind: "typical", zoneLength_m: 12.3 });
    // 12.3/6 = 2.05 → ОКРУГЛ(,1) = 2.1, ×4 ряда = 8.4 → ОКРУГЛВВЕРХ = 9
    expect(zone.brackets).toBe(9);
  });
});

describe("computeGirtZone — вес кронштейна и масса профиля", () => {
  it("одинарная схема — 0,75 кг на кронштейн", () => {
    const zone = computeGirtZone({
      zoneKind: "corner",
      zoneLength_m: 12,
      wallHeight_m: 3,
      postStep_m: 6,
      stepRigel_mm: 1000,
      profile: single,
      paired: false,
    });
    expect(zone.bracketWeight_kg).toBeCloseTo(zone.brackets * 0.75, 9);
  });

  it("спаренная схема — 1,5 кг на кронштейн, масса профиля по весу спаренного профиля", () => {
    const zone = computeGirtZone({
      zoneKind: "corner",
      zoneLength_m: 12,
      wallHeight_m: 3,
      postStep_m: 6,
      stepRigel_mm: 1000,
      profile: paired,
      paired: true,
    });
    expect(zone.bracketWeight_kg).toBeCloseTo(zone.brackets * 1.5, 9);
    // ряды=3(=ОКРУГЛВВЕРХ(3000/1000)+0), длина=3×12=36 м, масса=36×5,9044
    expect(zone.rows).toBe(3);
    expect(zone.profileLength_m).toBeCloseTo(36, 9);
    expect(zone.profileMass_kg).toBeCloseTo(36 * paired.weightPerMeter_kg, 6);
  });
});

describe("computeWallGirtSection", () => {
  it("удваивает результат на число одинаковых стен и считает накладные 2%", () => {
    const corner: GirtZoneInput = {
      zoneKind: "corner",
      zoneLength_m: 12,
      wallHeight_m: 3,
      postStep_m: 6,
      stepRigel_mm: 1000,
      profile: single,
      paired: false,
    };
    const typical: GirtZoneInput = { ...corner, zoneKind: "typical", zoneLength_m: 6 };

    const oneWall = computeWallGirtSection({ corner, typical, wallCount: 1 });
    const twoWalls = computeWallGirtSection({ corner, typical, wallCount: 2 });

    expect(twoWalls.totalMass_kg).toBeCloseTo(oneWall.totalMass_kg * 2, 6);
    expect(twoWalls.subtotalCost).toBeCloseTo(oneWall.subtotalCost! * 2, 2);
    expect(twoWalls.totalCost).toBeCloseTo(twoWalls.subtotalCost! * 1.02, 2);
  });

  it("кронштейны без подтверждённой цены — их cost=null, что по общему правилу (как у других разделов) обнуляет subtotalCost всей секции, а не только их строку", () => {
    const corner: GirtZoneInput = {
      zoneKind: "corner",
      zoneLength_m: 12,
      wallHeight_m: 3,
      postStep_m: 6,
      stepRigel_mm: 1000,
      profile: single,
      paired: false,
    };
    const typical: GirtZoneInput = { ...corner, zoneKind: "typical", zoneLength_m: 6 };
    const section = computeWallGirtSection({ corner, typical, wallCount: 2 });

    const bracketItems = section.items.filter((i) => i.name.startsWith("Кронштейны"));
    expect(bracketItems.every((i) => i.cost === null)).toBe(true);
    expect(section.subtotalCost).toBeNull();
    // Масса при этом считается независимо от цены.
    expect(section.totalMass_kg).toBeGreaterThan(0);
  });
});

describe("computeWallGirtWallType", () => {
  it("собирает секцию по названию профиля из каталога", () => {
    const section = computeWallGirtWallType({
      cornerZoneLength_m: 12,
      typicalZoneLength_m: 6,
      wallHeight_m: 3,
      postStep_m: 6,
      cornerStepRigel_mm: 1000,
      typicalStepRigel_mm: 1000,
      profileName: "ПС 145х45х1,5",
      paired: false,
    });
    expect(section).not.toBeNull();
    expect(section!.totalMass_kg).toBeGreaterThan(0);
  });

  it("возвращает null для неизвестного профиля", () => {
    const section = computeWallGirtWallType({
      cornerZoneLength_m: 12,
      typicalZoneLength_m: 6,
      wallHeight_m: 3,
      postStep_m: 6,
      cornerStepRigel_mm: 1000,
      typicalStepRigel_mm: 1000,
      profileName: "не существует в прайсе",
      paired: false,
    });
    expect(section).toBeNull();
  });
});
