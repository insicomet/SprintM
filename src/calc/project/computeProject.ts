import { computeSvCode, svCodeFromDistricts } from "../climate/svCode";
import {
  roofingSupplement_kPa,
  selectBankBlock,
  type BankBlock,
} from "../climate/snowLadder";
import { computeBracing, type StrutTube } from "../frame/bracing";
import { selectSecondaryMembers } from "../frame/secondaryMembers";
import { findFrameSelection, snapHeight } from "../frame/sectionBank";
import {
  computeRoofCladdingSection,
  computeWallCladdingSection,
  type CladdingSectionTakeoff,
} from "../cladding/claddingSections";
import {
  computeMezzanineItems,
  computeRoofUnpricedItems,
  computeWallUnpricedItems,
  type UnpricedSection,
} from "../cladding/unpricedItems";
import { computeOpeningsFraming } from "../geometry/openingsFraming";
import { facadePostCount } from "../facadePost/postCount";
import { selectFacadePost } from "../facadePost/selectFacadePost";
import { computeDrainage } from "../drainage/drainage";
import { computeRoofArea_m2, computeWallArea_m2 } from "../geometry/buildingEnvelope";
import { computeFrameExtras } from "../geometry/frameExtras";
import { computeFrameFasteners } from "../geometry/frameFasteners";
import { computeFrameTakeoff } from "../geometry/frameTakeoff";
import { computeHorizTiesMass_kg } from "../geometry/horizTies";
import {
  computeOpeningsArea_m2,
  computeOpeningsDeduction_m2,
  computeOpeningsCost,
  windowFramingPerimeter_m,
  type OpeningsInput,
} from "../geometry/openings";
import { computeRoofLoad, defaultRoofSlopeDeg } from "../loads/roofLoad";
import { computeCommercialSummary } from "../summary/commercialSummary";
import { computeRoofTrim } from "../roofTrim/roofTrim";
import { computeWallTrim } from "../wallTrim/wallTrim";
import { computePurlinLayout } from "../purlin/purlinLayout";
import { maxPurlinStepByDecking } from "../purlin/deckingSpan";
import {
  insulationThicknessForRoofing,
  purlinFamilyForRoofing,
  roofLoadForDecking_kPa,
  selectPurlin,
} from "../purlin/selectPurlin";
import roofingTypesRaw from "../../data/roofingSelfWeight.json";
import type { ResponsibilityLevel, Span } from "../../types/common";

const roofingTypes = roofingTypesRaw as { type: string; selfWeight_kg_m2: number }[];

/**
 * Накладные расходы раздела «Каркас» — 2%, как и во всех остальных
 * разделах ведомости (ячейки C31 и C99). В модулях обшивки, водостока
 * и доборных элементов они уже учтены внутри.
 */
const SECTION_OVERHEAD = 1.02;

export interface ProjectInputs {
  city: string;
  span: Span;
  length_m: number;
  height_m: number;
  /** γn — коэффициент надёжности по ответственности (вывод!D7), идёт в нагрузки. */
  gammaN: ResponsibilityLevel;
  /**
   * Блок банка сечений (подбор!W9). В исходнике он НЕ равен γn: его вместе
   * со снеговым районом выдаёт лестница нагрузок (climate/snowLadder.ts).
   * "auto" — как в исходнике, по лестнице.
   */
  bankK: "auto" | ResponsibilityLevel;
  /** Код «с/в» вручную; пусто — из нашей климатической базы. */
  svOverride?: string;
  /**
   * Расчётная снеговая нагрузка вручную, кН/м²; 0 или пусто — из нашей базы.
   *
   * Нужна для сверки: подборщик берёт снег из своего листа «Города п.К»,
   * где при заполненном столбце «По данным ГМЦ (прил. К)» используется он,
   * а не табличное значение по району. У Сургута это 1,8 против наших 2,0
   * по району IV — и от этого меняется весь подбор прогонов.
   */
  snowLoadOverride_kPa?: number;
  /** Тип покрытия (вывод!D20) — из roofingSelfWeight.json. */
  roofingType: string;
  /** Марка настила (вывод!D21) — ограничивает максимальный шаг прогонов. */
  deckingMark: string;
  /** Максимальный шаг прогонов вручную (вывод!D24); 0 — считать по настилу. */
  maxStepOverride_mm: number;
  /** Минимальный шаг прогонов (вывод!D25); 0 — без ограничения. */
  minStep_mm: number;
  /** Шаг рам вручную (вывод!D9); 0 — из банка сечений. */
  framePitchOverride_m: number;
  wallPanel_mm: number;
  roofPanel_mm: number;
  openings: OpeningsInput;
  /** Прогон под снегозадержание (вывод!D26) — он же множитель строки снегозадержателя. */
  snowGuards: boolean;
  /** Прогон под ограждение (вывод!D27). */
  railingPurlin: boolean;
  /** Количество распорок из трубы (K95) — вбито вручную. */
  tubeStrutCount: number;
  /**
   * Труба распорок вручную. Пусто — по правилу подборщика
   * (вывод!D38: шаг рам ≤ 4 м → 60х3, иначе 80х3).
   */
  strutTube?: StrutTube;
  /**
   * Слагаемое «Конструкций из труб» вручную, т. Пусто — считаем сами:
   * это металл обрамления проёмов (вывод!E68), см. openingsFraming.
   * Ручной ввод нужен, когда в проекте есть окна: их перемычки
   * подборщик подбирает у себя, и этот расчёт мы ещё не разобрали.
   */
  extraTubeMass_t?: number;
  /** Шаг стоек фахверка, м — влияет только на подбор сечения стойки. */
  postSpacing_m: number;
  /**
   * «Спринт с СГ по Р» — вариант каркаса со шпренгельной затяжкой
   * (вывод!C29: «для пролета 24м, если спринт с СГ по Р, пиши +»).
   * В банке такие строки есть только для пролёта 24 м и с/в 1/3.
   */
  trussedVariant?: boolean;
  /**
   * Считать раздел «Перекрытие». В обеих реальных ведомостях количества
   * там считаются всегда, но стоимость не заведена и итог равен нулю,
   * поэтому по умолчанию раздел выключен.
   */
  mezzanine?: boolean;
}

export type ProjectResult = ReturnType<typeof computeProject>;

/**
 * Весь расчёт объекта одной чистой функцией — ровно то, что раньше жило
 * россыпью useMemo в App.tsx.
 *
 * Вынесено, чтобы сверку с ведомостями расчётчика можно было
 * зафиксировать тестами, а не проверять глазами в браузере: см.
 * computeProject.test.ts, где оба реальных проекта прогоняются целиком.
 */
export function computeProject(inputs: ProjectInputs) {
  const {
    city,
    span,
    length_m,
    height_m,
    gammaN,
    bankK,
    svOverride,
    snowLoadOverride_kPa,
    roofingType,
    deckingMark,
    maxStepOverride_mm,
    minStep_mm,
    framePitchOverride_m,
    wallPanel_mm,
    roofPanel_mm,
    openings,
    snowGuards,
    railingPurlin,
    tubeStrutCount,
    strutTube,
    extraTubeMass_t,
    postSpacing_m,
    trussedVariant,
    mezzanine,
  } = inputs;

  // ---- Климат -------------------------------------------------------
  //
  // Снеговой район и коэффициент k блока банка ИНСИ выводит не из
  // справочника, а из НАГРУЗКИ — через лестницу порогов (снегветер).
  // Нагрузку берём свою, правило перевода — их. Ветровой район у них
  // читается по СП напрямую, как и у нас.
  let climate:
    | { ok: true; value: ReturnType<typeof computeSvCode>; overridden: boolean }
    | { ok: false; error: string };
  let bankBlock: BankBlock | null = null;
  try {
    const base = computeSvCode(city);
    const snow_kPa =
      snowLoadOverride_kPa != null && snowLoadOverride_kPa > 0
        ? snowLoadOverride_kPa
        : base.city.snow.sgKpa;

    bankBlock =
      snow_kPa === null ? null : selectBankBlock(snow_kPa, roofingType, gammaN);

    let value = base;
    if (bankBlock && base.city.wind.region) {
      const byLadder = svCodeFromDistricts(bankBlock.snowDistrict, base.city.wind.region);
      value = { ...base, raw: byLadder.raw, standard: byLadder.standard };
    }
    climate = {
      ok: true,
      value: svOverride ? { ...value, standard: svOverride } : value,
      overridden: Boolean(svOverride),
    };
  } catch (e) {
    climate = { ok: false, error: (e as Error).message };
  }

  // ---- Сечения рамы -------------------------------------------------
  let frame:
    | { ok: true; value: ReturnType<typeof findFrameSelection> }
    | { ok: false; error: string }
    | null = null;
  // Вариант «СГ по Р» есть в банке не для всякой комбинации; если его нет,
  // считаем по стандартному и говорим об этом.
  let trussedVariantMissing = false;
  if (climate.ok) {
    try {
      const query = {
        span,
        height_m,
        responsibility: bankK === "auto" ? (bankBlock?.bankK ?? gammaN) : bankK,
        svCode: climate.value.standard,
      };
      let value = findFrameSelection(
        trussedVariant ? { ...query, variant: "вариант_2" } : query,
      );
      if (trussedVariant && !value) {
        trussedVariantMissing = true;
        value = findFrameSelection(query);
      }
      frame = { ok: true, value };
    } catch (e) {
      frame = { ok: false, error: (e as Error).message };
    }
  }
  const selection = frame?.ok ? frame.value : null;

  let heightBucket: number | null;
  try {
    heightBucket = snapHeight(span, height_m);
  } catch {
    heightBucket = null;
  }

  const roofingSelfWeight_kg_m2 =
    roofingTypes.find((r) => r.type === roofingType)?.selfWeight_kg_m2 ?? 0;
  const sgFromBase = climate.ok ? climate.value.city.snow.sgKpa : null;
  const sgKpa =
    snowLoadOverride_kPa != null && snowLoadOverride_kPa > 0 ? snowLoadOverride_kPa : sgFromBase;
  const snowOverridden = sgKpa !== null && sgKpa !== sgFromBase;
  const roofSlopeDeg = defaultRoofSlopeDeg(span);

  const roofLoad =
    sgKpa === null
      ? null
      : computeRoofLoad({ sgKpa, roofSlopeDeg, selfWeight_kg_m2: roofingSelfWeight_kg_m2 });

  const geometry = {
    span_m: span,
    length_m,
    height_m,
    framePitch_m:
      framePitchOverride_m > 0 ? framePitchOverride_m : (selection?.framePitch_m ?? 6),
    roofSlopeDeg,
  };

  // ---- Каркас -------------------------------------------------------
  const frameTakeoff =
    selection && heightBucket !== null ? computeFrameTakeoff(geometry, selection) : null;

  // База формулы болтов М16 — «Болты в раме» выбранной строки банка.
  const frameFasteners =
    frameTakeoff && selection
      ? computeFrameFasteners(geometry, frameTakeoff.frameCount, selection.bolts.totalInFrame)
      : null;

  const frameExtras = frameTakeoff ? computeFrameExtras(geometry, frameTakeoff.frameCount) : null;

  // Второстепенные сечения — затяжки, распорки, связи, стойки фахверка:
  // подборщик выводит их формулами (вывод!D36:D41), см. secondaryMembers.
  const secondaryMembers = bankBlock
    ? selectSecondaryMembers({
        span_m: span,
        length_m,
        height_m,
        framePitch_m: geometry.framePitch_m,
        snowDistrict: bankBlock.snowDistrict,
        trussedVariant,
      })
    : null;
  const derivedStrutTube = secondaryMembers?.derived.find((m) => m.name === "Распорки")?.section;
  const effectiveStrutTube: StrutTube =
    strutTube ?? ((derivedStrutTube as StrutTube | undefined) ?? "80х3");

  // Слагаемое «Конструкций из труб», которое расчётчик вписывает руками:
  // это металл обрамления проёмов из подборщика (вывод!E68).
  const openingsFraming = computeOpeningsFraming({
    gatesCount: openings.gatesCount,
    gateWidth_m: openings.gateWidth_m,
    doorsCount: openings.doorsCount,
    framePitch_m: geometry.framePitch_m,
    hasWindows: openings.windowsCount > 0 && openings.windowWidth_m > 0,
  });
  const effectiveExtraTubeMass_t = extraTubeMass_t ?? openingsFraming.total_t;

  const bracing =
    frameTakeoff && selection
      ? computeBracing({
          span_m: span,
          length_m,
          height_m,
          framePitch_m: geometry.framePitch_m,
          frameCount: frameTakeoff.frameCount,
          tubeStrutCount,
          strutTube: effectiveStrutTube,
          extraTubeMass_t: effectiveExtraTubeMass_t,
          windowFramingPerimeter_m: windowFramingPerimeter_m(openings),
          gussetMassPerFrame_kg: selection.massGussetPlates_kg,
        })
      : null;

  const horizTiesMass_kg = climate.ok
    ? computeHorizTiesMass_kg(span, climate.value.standard, length_m)
    : null;

  // ---- Прогоны ------------------------------------------------------
  // «Макс шаг прогонов» (вывод!D23): по несущей способности настила при
  // нагрузке на покрытие × 1,15. Ручной ввод (вывод!D24) перекрывает его.
  const maxPurlinStep =
    sgKpa === null
      ? null
      : maxStepOverride_mm > 0
        ? maxStepOverride_mm
        : maxPurlinStepByDecking(deckingMark, roofLoadForDecking_kPa(sgKpa, roofSlopeDeg) * 1.15);

  const purlin =
    sgKpa === null || maxPurlinStep === null
      ? null
      : selectPurlin(
          {
            span_m: span,
            framePitch_m: geometry.framePitch_m,
            snowLoad_kPa: sgKpa,
            roofingSelfWeight_kg_m2,
            roofSlopeDeg,
            gammaN,
            maxStep_mm: maxPurlinStep,
            minStep_mm,
            snowGuardPurlin: snowGuards,
            railingPurlin,
            family: purlinFamilyForRoofing(roofingType),
            insulationThickness_mm: insulationThicknessForRoofing(roofingType),
          },
          length_m,
        );

  const purlinLayout = purlin
    ? computePurlinLayout(purlin, span, length_m, {
        snowGuardPurlin: snowGuards,
        railingPurlin,
      })
    : null;

  // ---- Ограждение ---------------------------------------------------
  const openingsArea = computeOpeningsArea_m2(openings);
  // Из стены вычитаются размеры, округлённые вниз до целых метров.
  const openingsDeduction = computeOpeningsDeduction_m2(openings);
  const openingsCost = computeOpeningsCost(openings);

  const grossWallArea = computeWallArea_m2(geometry);
  const envelope = {
    grossWallArea,
    wallArea: Math.max(0, grossWallArea - openingsDeduction),
    roofArea: computeRoofArea_m2(geometry),
  };

  const wallCladding: CladdingSectionTakeoff = computeWallCladdingSection(
    geometry,
    envelope.wallArea,
    wallPanel_mm,
  );
  const roofCladding = purlinLayout
    ? computeRoofCladdingSection(geometry, envelope.roofArea, roofPanel_mm, purlinLayout.lineCount)
    : null;

  const wallTrim = computeWallTrim(geometry);
  const roofTrim = computeRoofTrim(geometry, { snowGuards });
  const drainage = computeDrainage(geometry);

  // Строки ведомости, у которых количество считается, а стоимость не заведена.
  const unpricedSections: UnpricedSection[] = [computeWallUnpricedItems(geometry)];
  if (purlinLayout) {
    unpricedSections.push(
      computeRoofUnpricedItems(geometry, roofPanel_mm, purlinLayout.totalProfileLength_m),
    );
  }
  if (mezzanine && frameTakeoff) {
    unpricedSections.push(computeMezzanineItems(geometry, frameTakeoff.frameCount));
  }

  // ---- Фахверк ------------------------------------------------------
  const w0Kpa = climate.ok ? climate.value.city.wind.w0Kpa : null;
  const facadePost =
    w0Kpa === null ? undefined : selectFacadePost({ w0_kPa: w0Kpa, postSpacing_m, height_m });
  const facadePostLayout = facadePost
    ? (() => {
        // Количество — по практическому правилу (не из формул исходного
        // файла ИНСИ, см. facadePost/postCount.ts), не по периметру/шагу.
        const postCount = facadePostCount(span);
        const totalLength_m = postCount * height_m;
        return {
          postCount,
          totalLength_m,
          totalMass_kg: totalLength_m * facadePost.profile.mass_kg_per_m,
        };
      })()
    : null;

  // ---- Коммерческая сводка ------------------------------------------
  // Раскладка по статьям исходной ведомости (строки 155–160).
  // «Каркас» = F32 + F100, «Стеновое» = F44 + F114,
  // «Кровельное» = F147 + F70 + F81.
  const frameMaterials =
    frameTakeoff?.totalFrameCost != null &&
    purlinLayout?.totalCost != null &&
    frameExtras != null &&
    frameFasteners != null &&
    bracing?.totalCost != null
      ? (frameTakeoff.totalFrameCost +
          purlinLayout.totalCost +
          frameExtras.totalCost +
          frameFasteners.totalCost +
          bracing.totalCost) *
        SECTION_OVERHEAD
      : null;

  const wallMaterials =
    wallCladding.totalCost != null ? wallCladding.totalCost + wallTrim.totalCost : null;
  const roofMaterials =
    roofCladding?.totalCost != null
      ? roofCladding.totalCost + drainage.totalCost + roofTrim.totalCost
      : null;

  const commercial = computeCommercialSummary({
    frameMaterials,
    wallMaterials,
    roofMaterials,
    openingsCost: openingsCost.totalCost,
    frameMissing: bracing?.missing,
  });

  // ---- Справочные итоги ---------------------------------------------
  const steelMass_kg =
    (frameTakeoff?.totalFrameMass_kg ?? 0) +
    (frameFasteners?.totalMass_kg ?? 0) +
    (bracing?.totalMass_kg ?? 0) +
    (frameExtras?.totalMass_kg ?? 0) +
    wallTrim.totalMass_kg +
    (purlinLayout?.totalMass_kg ?? 0) +
    (facadePostLayout?.totalMass_kg ?? 0);
  const claddingMass_kg = wallCladding.totalMass_kg + (roofCladding?.totalMass_kg ?? 0);
  const hasFullSteelMass =
    frameTakeoff?.totalFrameMass_kg != null &&
    frameFasteners !== null &&
    bracing?.totalMass_kg != null &&
    purlinLayout?.totalMass_kg != null &&
    facadePostLayout?.totalMass_kg != null;

  const claddingCost =
    wallCladding.totalCost != null && roofCladding?.totalCost != null
      ? wallCladding.totalCost + roofCladding.totalCost
      : null;

  const knownCost =
    (frameTakeoff?.totalFrameCost ?? 0) +
    (claddingCost ?? 0) +
    (purlinLayout?.totalCost ?? 0) +
    (frameFasteners?.totalCost ?? 0) +
    (frameExtras?.totalCost ?? 0) +
    (bracing?.totalCost ?? 0) +
    wallTrim.totalCost +
    drainage.totalCost +
    roofTrim.totalCost;
  const hasFullCost =
    frameTakeoff?.totalFrameCost != null &&
    claddingCost != null &&
    purlinLayout?.totalCost != null &&
    bracing?.totalCost != null;

  // Доля каждой статьи в известной стоимости — обшивка не зависит от
  // климата (только от геометрии) и обычно доминирует, из-за чего при
  // смене города меняется в основном «невидимая на глаз» часть.
  const shareOf = (cost: number | null | undefined) =>
    cost != null && knownCost > 0 ? (cost / knownCost) * 100 : null;

  return {
    climate,
    /** Пара «снеговой район + k», выбранная лестницей нагрузок ИНСИ. */
    bankBlock,
    /** Почему лестница не дала пару — если не дала. */
    bankBlockMissing:
      bankBlock !== null
        ? null
        : roofingSupplement_kPa(roofingType) === null
          ? ("покрытие" as const)
          : ("нагрузка" as const),
    /** Снеговая нагрузка, фактически ушедшая в расчёт, кН/м². */
    snowLoad_kPa: sgKpa,
    snowOverridden,
    frame,
    trussedVariantMissing,
    heightBucket,
    geometry,
    roofLoad,
    frameTakeoff,
    frameFasteners,
    frameExtras,
    bracing,
    horizTiesMass_kg,
    maxPurlinStep,
    purlin,
    purlinLayout,
    openingsArea,
    openingsDeduction,
    openingsCost,
    envelope,
    wallCladding,
    roofCladding,
    wallTrim,
    roofTrim,
    drainage,
    unpricedSections,
    secondaryMembers,
    effectiveStrutTube,
    openingsFraming,
    effectiveExtraTubeMass_t,
    facadePost,
    facadePostLayout,
    commercial,
    summary: {
      steelMass_kg,
      claddingMass_kg,
      hasFullSteelMass,
      claddingCost,
      knownCost,
      hasFullCost,
      shares: {
        frame: shareOf(frameTakeoff?.totalFrameCost),
        purlin: shareOf(purlinLayout?.totalCost),
        cladding: shareOf(claddingCost),
        drainage: shareOf(drainage.totalCost),
        fasteners: shareOf(frameFasteners?.totalCost),
        bracing: shareOf(bracing?.totalCost),
        roofTrim: shareOf(roofTrim.totalCost),
        profiles: shareOf((frameExtras?.totalCost ?? 0) + wallTrim.totalCost),
      },
    },
  };
}
