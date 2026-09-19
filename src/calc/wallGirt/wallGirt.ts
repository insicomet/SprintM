import { buildSection, type CladdingItem, type CladdingSectionTakeoff } from "../cladding/claddingSections";
import { findGirtProfile } from "./catalog";
import { selectGirtProfile } from "./selectGirt";
import type { GirtZoneInput, GirtZoneResult, WallGirtWallTypeConfig } from "./types";

const BRACKET_WEIGHT_PAIRED_kg = 1.5;
const BRACKET_WEIGHT_SINGLE_kg = 0.75;

function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Одна зона обвязки стены под профлист (угловая или рядовая) —
 * «упрощённый режим» без авто-подбора профиля по ветровому
 * зонированию и базе профилей (890 строк подбора — решение по объёму,
 * см. артефакт с вопросами расчётчику): профиль/материал/шаг ригелей
 * задаёт менеджер, приложение считает по уже подтверждённым формулам.
 *
 * Формулы — живой текст из «Калькулятор ограждайки v1.5.xlsx»
 * (SHA-256 4A9343A1E3149954DEC0F91D5398528F18016A8423EC204CE2B92A59F612DEAF,
 * только чтение, Лист1!B49:K51):
 *
 *   ряды        = ОКРУГЛВВЕРХ(высота_мм / шаг_ригелей_мм)
 *                 + (спаренная схема? 0 : 1)                    [F49/F50]
 *   кронштейны, угловая = ряды × протяжённость / шаг_стоек
 *                 — БЕЗ округления, буквально формула файла       [G49]
 *   кронштейны, рядовая = ОКРУГЛВВЕРХ(ряды × ОКРУГЛ(протяжённость / шаг_стоек, 1))
 *                                                                  [G50]
 *   вес кронштейна = 1,5 кг (схема «[]»/«[-]») иначе 0,75 кг      [AA7]
 *   масса профиля  = ряды × протяжённость × вес_1м_профиля        [I49/I50]
 *
 * «Спаренная схема» — свойство выбранного профиля (например «2ПС
 * 145х45х1,5»): вес погонного метра уже учитывает спаривание, поэтому
 * здесь нет отдельного множителя массы — см. src/calc/wallGirt/catalog.ts.
 */
export function computeGirtZone(input: GirtZoneInput): GirtZoneResult {
  const stepRigel_m = input.stepRigel_mm / 1000;
  const rows = Math.ceil(input.wallHeight_m / stepRigel_m) + (input.paired ? 0 : 1);

  const brackets =
    input.zoneKind === "corner"
      ? (rows * input.zoneLength_m) / input.postStep_m
      : Math.ceil(rows * roundTo1(input.zoneLength_m / input.postStep_m));

  const bracketWeight_kg = brackets * (input.paired ? BRACKET_WEIGHT_PAIRED_kg : BRACKET_WEIGHT_SINGLE_kg);
  const profileLength_m = rows * input.zoneLength_m;
  const profileMass_kg = profileLength_m * input.profile.weightPerMeter_kg;

  return { input, rows, brackets, bracketWeight_kg, profileLength_m, profileMass_kg };
}

function zoneItems(zone: GirtZoneResult, zoneLabel: string): CladdingItem[] {
  const { input } = zone;
  const profileCost =
    input.profile.pricePerMeter != null ? zone.profileLength_m * input.profile.pricePerMeter : null;
  return [
    {
      name: `Обвязка стены, ${zoneLabel} зона — ${input.profile.name}`,
      count: zone.profileLength_m,
      unit: "п.м.",
      unitPrice: input.profile.pricePerMeter,
      unitMass_kg: input.profile.weightPerMeter_kg,
      cost: profileCost,
      mass_kg: zone.profileMass_kg,
    },
    {
      name: `Кронштейны, ${zoneLabel} зона`,
      count: zone.brackets,
      unit: "шт",
      // Цена заготовки кронштейнов в реальной ведомости («21604», строка
      // 38) не подтверждена — числа в её формуле не совпадают с
      // габаритами того же объекта (открытый вопрос расчётчику), поэтому
      // не подставляем цену наугад.
      unitPrice: null,
      unitMass_kg: input.paired ? BRACKET_WEIGHT_PAIRED_kg : BRACKET_WEIGHT_SINGLE_kg,
      cost: null,
      mass_kg: zone.bracketWeight_kg,
    },
  ];
}

export interface WallGirtWallTypeInput {
  corner: GirtZoneInput;
  typical: GirtZoneInput;
  /** Число одинаковых стен этого типа (торцевых или продольных) — обычно 2. */
  wallCount: number;
}

/**
 * Обвязка стен под профлист для одного типа стены (торцевой или
 * продольной), умноженная на число одинаковых стен этого типа —
 * расчётчик считает калькулятор отдельно для каждого типа стены и
 * удваивает результат на вторую такую же стену.
 */
export function computeWallGirtSection(input: WallGirtWallTypeInput): CladdingSectionTakeoff {
  return buildWallGirtSection(computeGirtZone(input.corner), computeGirtZone(input.typical), input.wallCount);
}

/** Собрать ведомость обвязки из уже посчитанных зон (ручной ввод или автоподбор). */
function buildWallGirtSection(
  corner: GirtZoneResult,
  typical: GirtZoneResult,
  wallCount: number,
): CladdingSectionTakeoff {
  const perWallItems = [...zoneItems(corner, "угловая"), ...zoneItems(typical, "рядовая")];
  const items: CladdingItem[] = perWallItems.map((item) => ({
    ...item,
    count: item.count * wallCount,
    mass_kg: item.mass_kg * wallCount,
    cost: item.cost != null ? item.cost * wallCount : null,
  }));

  return buildSection(items);
}

/** Контекст проекта, нужный автоподбору обвязки (высота/нагрузка/ответственность здания). */
export interface WallGirtAutoContext {
  w0_kPa: number;
  buildingHeight_m: number;
  gammaN: number;
}

/**
 * Обвязка стен под профлист для одного типа стены, заданная в форме
 * ввода — либо ручной выбор профиля/шага (название профиля из каталога
 * вместо готового {@link GirtProfileOption}), либо автоподбор по ветровой
 * нагрузке (см. selectGirt.ts). null — если профиль не найден в каталоге
 * (ручной ввод) или ни один профиль не проходит проверку прочности ни на
 * одном шаге (автоподбор) — контекст проекта для автоподбора тоже
 * обязателен, без него автоподбор посчитать нечем.
 */
export function computeWallGirtWallType(
  config: WallGirtWallTypeConfig,
  wallCount = 2,
  autoContext?: WallGirtAutoContext,
): CladdingSectionTakeoff | null {
  if (config.mode === "auto") {
    if (!autoContext) return null;
    const cornerAuto = selectGirtProfile({
      zoneKind: "corner",
      zoneLength_m: config.cornerZoneLength_m,
      wallHeight_m: config.wallHeight_m,
      postStep_m: config.postStep_m,
      terrain: config.terrain,
      insulationThickness_mm: config.insulationThickness_mm,
      minStep_mm: config.minStep_mm,
      maxStep_mm: config.maxStep_mm,
      minProfileHeight_mm: config.minProfileHeight_mm,
      maxProfileHeight_mm: config.maxProfileHeight_mm,
      ...autoContext,
    });
    const typicalAuto = selectGirtProfile({
      zoneKind: "typical",
      zoneLength_m: config.typicalZoneLength_m,
      wallHeight_m: config.wallHeight_m,
      postStep_m: config.postStep_m,
      terrain: config.terrain,
      insulationThickness_mm: config.insulationThickness_mm,
      minStep_mm: config.minStep_mm,
      maxStep_mm: config.maxStep_mm,
      minProfileHeight_mm: config.minProfileHeight_mm,
      maxProfileHeight_mm: config.maxProfileHeight_mm,
      ...autoContext,
    });
    if (!cornerAuto || !typicalAuto) return null;
    return buildWallGirtSection(cornerAuto.zone, typicalAuto.zone, wallCount);
  }

  const profile = findGirtProfile(config.profileName, config.paired);
  if (!profile) return null;

  const corner: GirtZoneInput = {
    zoneKind: "corner",
    zoneLength_m: config.cornerZoneLength_m,
    wallHeight_m: config.wallHeight_m,
    postStep_m: config.postStep_m,
    stepRigel_mm: config.cornerStepRigel_mm,
    profile,
    paired: config.paired,
  };
  const typical: GirtZoneInput = {
    ...corner,
    zoneKind: "typical",
    zoneLength_m: config.typicalZoneLength_m,
    stepRigel_mm: config.typicalStepRigel_mm,
  };

  return computeWallGirtSection({ corner, typical, wallCount });
}
