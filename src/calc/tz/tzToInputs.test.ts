import { describe, expect, it } from "vitest";
import { parseTz } from "./parseTz";
import { TZ_22326 } from "./tz22326.fixture";
import { TZ_22330 } from "./tz22330.fixture";
import { tzToInputs } from "./tzToInputs";
import {
  computeOpeningsArea_m2,
  computeOpeningsDeduction_m2,
  groupsCount,
} from "../geometry/openings";

describe("tzToInputs — ТЗ 22326", () => {
  const fill = tzToInputs(parseTz(TZ_22326));

  it("fills the object card from the brief", () => {
    expect(fill.city).toBe("Увильды");
    expect(fill.span).toBe(12);
    expect(fill.length_m).toBe(26);
    expect(fill.height_m).toBe(4);
    expect(fill.wallPanel_mm).toBe(150);
    expect(fill.roofPanel_mm).toBe(150);
    expect(fill.snowGuards).toBe(true);
    expect(fill.fireResistanceRating).toBe(5);
  });

  it("turns the windows the right way up, one slot per size", () => {
    // В ТЗ «1х6м»; шестиметрового окна в четырёхметровом здании не бывает,
    // значит это лента 6 × 1. Тем более что и в реальных проектах окна
    // ленточные — 30 × 1 в «22316», 46 × 1 в «22285».
    //
    // Расчётчик подтвердила (вопрос 02), что несколько размеров одного
    // типа она заводит отдельными слотами, а не сводит в один усреднённый
    // — здесь ТРИ слота, один на каждый размер из ТЗ.
    expect(fill.openings.windows).toEqual([
      { width_m: 3, height_m: 1, count: 2 },
      { width_m: 3.5, height_m: 1, count: 1 },
      { width_m: 6, height_m: 1, count: 2 },
    ]);
    expect(fill.adjustments.some((a) => a.includes("ленточные"))).toBe(true);
  });

  it("keeps every door size as its own slot too", () => {
    // Двери 1×2,1 и 1,6×2,1 — два разных размера, два слота, без свода.
    expect(fill.openings.doors).toEqual([
      { width_m: 1, height_m: 2.1, count: 1 },
      { width_m: 1.6, height_m: 2.1, count: 1 },
    ]);
    expect(groupsCount(fill.openings.doors)).toBe(2);
  });

  it("adds up to the exact area and deduction — nothing lost to averaging", () => {
    // Окна 3×1 ×2, 3,5×1 ×1, 6×1 ×2 — площадь 21,5 м² на пять штук;
    // двери 1×2,1 и 1,6×2,1 — 5,46 м².
    expect(computeOpeningsArea_m2(fill.openings)).toBeCloseTo(21.5 + 5.46 + 2.5 * 2.5, 6);

    // Раньше сведение нескольких размеров окон в один усреднённый (4,3 м)
    // теряло здесь целый метр вычета из стены (29 → 28 м²) — оговорка,
    // которую приходилось выносить в adjustments. Слотами вместо
    // усреднения эта потеря пропала: вычет теперь точно поштучный —
    // окна 3+3+3+6+6=21 (3,5 округляется вниз до 3), двери 2+2=4,
    // ворота 2×2=4.
    expect(computeOpeningsDeduction_m2(fill.openings)).toBeCloseTo(21 + 4 + 4, 9);
    expect(fill.adjustments.some((a) => a.includes("вместо"))).toBe(false);
  });

  it("does not merge anything — one size in the ТЗ means one slot, nothing to report", () => {
    // Ворота одного размера — сводить нечего, и сводить вообще больше
    // нечего никогда: список правок теперь говорит только о развороте
    // окон в ленточные, а не о том, что где-то усреднили размеры.
    expect(fill.adjustments).toEqual(["Окна развёрнуты в ленточные: меньшая сторона принята за высоту"]);
  });
});

describe("tzToInputs — ТЗ 22330 (пункт 14 «нет» разносится на все три поля)", () => {
  const fill = tzToInputs(parseTz(TZ_22330));

  it("reads the panel thickness from item 11, gates onto the long wall", () => {
    expect(fill.wallPanel_mm).toBe(100);
    expect(fill.roofPanel_mm).toBe(150);
    expect(fill.openings.gates).toEqual([{ width_m: 4, height_m: 4, count: 2, onLongWall: true }]);
  });

  it("turns off snow guards, drainage and the roof railing purlin together", () => {
    // Пункт 14 — одна строка на все три; «нет» должно выключить все три,
    // а не только снегозадержатель (водосток раньше оставался включённым
    // по умолчанию, даже когда в ТЗ прямо написано «нет»).
    expect(fill.snowGuards).toBe(false);
    expect(fill.hasDrainage).toBe(false);
    expect(fill.railingPurlin).toBe(false);
  });
});
