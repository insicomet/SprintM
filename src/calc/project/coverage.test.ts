import { describe, expect, it } from "vitest";
import settlementsRaw from "../../data/settlementsClimate.json";
import { getAllSettlementNames, qualifiedSettlementName } from "../climate/svCode";
import { findFrameSelection } from "../frame/sectionBank";
import { computeProject, type ProjectInputs } from "./computeProject";
import type { SettlementClimate } from "../climate/types";
import { SPANS, type ResponsibilityLevel, type Span } from "../../types/common";

const settlements = settlementsRaw as unknown as SettlementClimate[];

/** Высоты, попадающие в каждую из корзин банка (см. HEIGHT_BUCKETS_*). */
const HEIGHTS_9_21 = [3, 4.5, 6];
const HEIGHTS_24 = [6, 7, 8, 9];

function heightsFor(span: Span): number[] {
  return span === 24 ? HEIGHTS_24 : HEIGHTS_9_21;
}

/** Обычное здание — климат меняем, всё остальное держим постоянным. */
const BASE: ProjectInputs = {
  city: "",
  span: 18,
  length_m: 30,
  height_m: 5,
  gammaN: 1,
  bankK: "auto",
  roofingType: "С-П 150",
  deckingMark: "С44-1000-0,7",
  maxStepOverride_mm: 0,
  minStep_mm: 0,
  framePitchOverride_m: 0,
  wallPanel_mm: 150,
  roofPanel_mm: 150,
  openings: {
    gates: [{ count: 1, width_m: 4, height_m: 4 }],
    doors: [{ count: 1, width_m: 1, height_m: 2 }],
    windows: [],
  },
  snowGuards: true,
  railingPurlin: false,
  tubeStrutCount: 3,
  postSpacing_m: 2,
};

/**
 * Покрытие справочника: доходит ли расчёт до каждого реального города.
 *
 * Это не сверка с расчётчиком, а проверка полноты данных. С тех пор как
 * проектировщик разрешил считать края «по ближайшей строке с пометкой
 * „требует проверки“» (вопрос 04), дыра здесь означает уже не ошибку у
 * пользователя, а расчёт, который молча ушёл в приблизительный.
 */
describe("покрытие климатического справочника", () => {
  const results = settlements.map((s) => ({
    name: qualifiedSettlementName(s),
    project: computeProject({ ...BASE, city: qualifiedSettlementName(s) }),
  }));

  it("считает каждый город справочника без ошибок", () => {
    const broken = results
      .filter((r) => !r.project.climate.ok)
      .map((r) => `${r.name}: ${r.project.climate.ok ? "" : r.project.climate.error}`);
    expect(broken).toEqual([]);

    const noSections = results
      .filter((r) => !r.project.frame?.ok || !r.project.frame.value)
      .map((r) => r.name);
    expect(noSections).toEqual([]);
  });

  it("помечает «требует проверки» ровно 47 городов на краю таблиц", () => {
    const flagged = results.filter((r) => r.project.requiresCheck);
    // 47 — это весь край справочника: Камчатка, Сахалин, Курилы, Кольский
    // полуостров, Воркута, Черноморское побережье, Дагестан. Число здесь
    // не «сколько получилось», а граница: если оно выросло, значит
    // приблизительным стал считаться кто-то ещё.
    expect(flagged.length).toBe(47);

    const byKind = new Map<string, number>();
    for (const r of flagged) {
      for (const a of r.project.approximations) {
        byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries(byKind)).toEqual({
      // Сочетание снега с ветром вне банка — Сахалин, Камчатка, Мурманск, юг.
      "сочетание": 41,
      // Нагрузка выше последней ступени лестницы (2,60 кПа).
      "лестница": 13,
      // Ветровой район не проставлен: Дербент, Избербаш, Багратионовск.
      "ветер": 3,
    });
  });

  it("объясняет каждое допущение словами, а не кодом", () => {
    for (const r of results) {
      for (const a of r.project.approximations) {
        expect(a.message.length).toBeGreaterThan(20);
        expect(a.message).toMatch(/считаю по/);
      }
    }
  });

  it("остальные города считаются точно, без пометки", () => {
    const exact = results.filter((r) => !r.project.requiresCheck);
    expect(exact.length).toBe(settlements.length - 47);
    for (const r of exact) expect(r.project.approximations).toEqual([]);
  });

  it("every combination the ladder can produce exists in the section bank", () => {
    const combos = new Set<string>();
    for (const gammaN of [1.0, 0.8] as ResponsibilityLevel[]) {
      for (const s of settlements) {
        const project = computeProject({
          ...BASE,
          gammaN,
          city: qualifiedSettlementName(s),
        });
        if (!project.climate.ok || !project.bankBlock) continue;
        combos.add(`${project.climate.value.standard}|${project.bankBlock.bankK}`);
      }
    }

    const holes: string[] = [];
    for (const combo of combos) {
      const [svCode, k] = combo.split("|");
      const responsibility = Number(k) as ResponsibilityLevel;
      for (const span of SPANS) {
        for (const height_m of heightsFor(span)) {
          // findFrameSelection не бросает, а возвращает undefined —
          // ловим именно это, иначе дыры проходят мимо теста.
          let found: unknown;
          try {
            found = findFrameSelection({ span, height_m, responsibility, svCode });
          } catch {
            found = undefined;
          }
          if (!found) holes.push(`${svCode} · k=${k} · ${span}м · h${height_m}`);
        }
      }
    }
    expect(holes).toEqual([]);
    expect(combos.size).toBeGreaterThan(0);
  });

  it("Южно-Сахалинск считается целиком и назван приблизительным", () => {
    // Самый тяжёлый случай справочника: он не проходит СРАЗУ по двум
    // таблицам — 3,85 кПа снега выше лестницы, а сочетание 5/6 в банке
    // не просчитано. Раньше здесь была ошибка и пустая ведомость.
    const p = computeProject({ ...BASE, city: "Южно-Сахалинск, Сахалинская область" });
    expect(p.climate.ok).toBe(true);
    expect(p.requiresCheck).toBe(true);
    expect(p.approximations.map((a) => a.kind).sort()).toEqual(["лестница", "сочетание"]);
    expect(p.bankBlock?.snowDistrict).toBe("V");
    expect(p.climate.ok && p.climate.value.standard).toBe("5/3");
    // И, главное, ведомость действительно посчиталась.
    expect(p.frame?.ok && p.frame.value).toBeTruthy();
    expect(p.commercial.totalCost).toBeGreaterThan(0);
  });

  it("the settlement dropdown offers every settlement exactly once", () => {
    const names = getAllSettlementNames();
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(settlements.length);
  });
});
