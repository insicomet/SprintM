import { Fragment, useMemo, useState } from "react";
import { computeSvCode, getAllSettlementNames } from "./calc/climate/svCode";
import { computeBracing, type StrutTube } from "./calc/frame/bracing";
import { findFrameSelection, snapHeight } from "./calc/frame/sectionBank";
import {
  computeRoofCladdingSection,
  computeWallCladdingSection,
} from "./calc/cladding/claddingSections";
import { getSandwichPanelThicknesses } from "./calc/cladding/sandwichPanel";
import {
  computeRoofUnpricedItems,
  computeWallUnpricedItems,
} from "./calc/cladding/unpricedItems";
import { facadePostCount } from "./calc/facadePost/postCount";
import { selectFacadePost } from "./calc/facadePost/selectFacadePost";
import { computeDrainage } from "./calc/drainage/drainage";
import { computeRoofArea_m2, computeWallArea_m2 } from "./calc/geometry/buildingEnvelope";
import { computeFrameExtras } from "./calc/geometry/frameExtras";
import { computeFrameFasteners } from "./calc/geometry/frameFasteners";
import { rafterLengthPerFrame_m } from "./calc/geometry/frameGeometry";
import { computeFrameTakeoff } from "./calc/geometry/frameTakeoff";
import { computeHorizTiesMass_kg } from "./calc/geometry/horizTies";
import {
  computeOpeningsArea_m2,
  computeOpeningsCost,
  DEFAULT_OPENINGS,
  windowFramingPerimeter_m,
  type OpeningsInput,
} from "./calc/geometry/openings";
import { computeRoofLoad, defaultRoofSlopeDeg } from "./calc/loads/roofLoad";
import { computeCommercialSummary } from "./calc/summary/commercialSummary";
import { computeRoofTrim } from "./calc/roofTrim/roofTrim";
import { computeWallTrim } from "./calc/wallTrim/wallTrim";
import { computePurlinLayout } from "./calc/purlin/purlinLayout";
import {
  DECKING_MARKS,
  DEFAULT_DECKING_MARK,
  maxPurlinStepByDecking,
} from "./calc/purlin/deckingSpan";
import {
  insulationThicknessForRoofing,
  purlinFamilyForRoofing,
  roofLoadForDecking_kPa,
  selectPurlin,
} from "./calc/purlin/selectPurlin";
import roofingTypesRaw from "./data/roofingSelfWeight.json";
import { SPANS, type ResponsibilityLevel, type Span } from "./types/common";

// Одноимённые города (два Берёзовских, два Гурьевска и т.п.) приходят
// уже в уточнённой форме "Город, Регион", поэтому список уникален и
// позволяет выбрать нужный осознанно.
const settlementNames = getAllSettlementNames();

const roofingTypes = roofingTypesRaw as { type: string; selfWeight_kg_m2: number }[];

// Накладные расходы раздела «Каркас» — 2%, как и во всех остальных
// разделах ведомости (ячейки C31 и C99). В модулях обшивки, водостока
// и доборных элементов они уже учтены внутри.
const SECTION_OVERHEAD = 1.02;

export function App() {
  const [city, setCity] = useState("Челябинск");
  const [span, setSpan] = useState<Span>(18);
  const [length, setLength] = useState(30);
  const [height, setHeight] = useState(5);
  const [responsibility, setResponsibility] = useState<ResponsibilityLevel>(1.0);
  const [roofingType, setRoofingType] = useState(
    roofingTypes.find((r) => r.type === "С-П 150")!.type,
  );
  const [deckingMark, setDeckingMark] = useState(DEFAULT_DECKING_MARK);
  // 0 — считать максимальный шаг по несущей способности настила (вывод!D24 пусто).
  const [maxStepOverrideMm, setMaxStepOverrideMm] = useState(0);
  // В обоих реальных проектах стена 100мм, кровля 150мм.
  const [wallThickness, setWallThickness] = useState(100);
  const [roofThickness, setRoofThickness] = useState(150);
  const [openings, setOpenings] = useState<OpeningsInput>(DEFAULT_OPENINGS);
  const [postSpacing, setPostSpacing] = useState(2);
  const [snowGuards, setSnowGuards] = useState(true);
  // Ручные входы строки «Конструкции из труб» — правила для них в исходнике нет.
  const [tubeStrutCount, setTubeStrutCount] = useState(3);
  const [strutTube, setStrutTube] = useState<StrutTube>("80х3");
  const [extraTubeMass_t, setExtraTubeMass] = useState(0.432);

  const climate = useMemo(() => {
    try {
      return { ok: true as const, value: computeSvCode(city) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [city]);

  const frame = useMemo(() => {
    if (!climate.ok) return null;
    try {
      const result = findFrameSelection({
        span,
        height_m: height,
        responsibility,
        svCode: climate.value.standard,
      });
      return { ok: true as const, value: result };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [climate, span, height, responsibility]);

  const heightBucket = useMemo(() => {
    try {
      return snapHeight(span, height);
    } catch {
      return null;
    }
  }, [span, height]);

  const roofLoad = useMemo(() => {
    if (!climate.ok || climate.value.city.snow.sgKpa === null) return null;
    const selfWeight = roofingTypes.find((r) => r.type === roofingType)?.selfWeight_kg_m2 ?? 0;
    return computeRoofLoad({
      sgKpa: climate.value.city.snow.sgKpa,
      roofSlopeDeg: defaultRoofSlopeDeg(span),
      selfWeight_kg_m2: selfWeight,
    });
  }, [climate, roofingType, span]);

  const geometry = useMemo(
    () => ({
      span_m: span,
      length_m: length,
      height_m: height,
      framePitch_m: frame?.ok && frame.value ? frame.value.framePitch_m : 6,
      roofSlopeDeg: defaultRoofSlopeDeg(span),
    }),
    [span, length, height, frame],
  );

  const frameTakeoff = useMemo(() => {
    if (!frame?.ok || !frame.value || heightBucket === null) return null;
    return computeFrameTakeoff(geometry, frame.value);
  }, [frame, geometry, heightBucket]);

  const frameFasteners = useMemo(() => {
    if (!frameTakeoff || !frame?.ok || !frame.value) return null;
    // База формулы болтов М16 — «Болты в раме» выбранной строки банка.
    return computeFrameFasteners(geometry, frameTakeoff.frameCount, frame.value.bolts.totalInFrame);
  }, [frameTakeoff, geometry, frame]);

  const frameExtras = useMemo(() => {
    if (!frameTakeoff) return null;
    return computeFrameExtras(geometry, frameTakeoff.frameCount);
  }, [frameTakeoff, geometry]);

  const wallTrim = useMemo(() => computeWallTrim(geometry), [geometry]);

  const horizTiesMass_kg = useMemo(() => {
    if (!climate.ok) return null;
    return computeHorizTiesMass_kg(span, climate.value.standard, length);
  }, [climate, span, length]);

  const bracing = useMemo(() => {
    if (!frameTakeoff || !frame?.ok || !frame.value) return null;
    return computeBracing({
      span_m: span,
      length_m: geometry.length_m,
      height_m: geometry.height_m,
      framePitch_m: geometry.framePitch_m,
      frameCount: frameTakeoff.frameCount,
      tubeStrutCount,
      strutTube,
      extraTubeMass_t,
      windowFramingPerimeter_m: windowFramingPerimeter_m(openings),
      gussetMassPerFrame_kg: frame.value.massGussetPlates_kg,
    });
  }, [frameTakeoff, frame, span, geometry, tubeStrutCount, strutTube, extraTubeMass_t, openings]);

  const drainage = useMemo(() => computeDrainage(geometry), [geometry]);

  const roofTrim = useMemo(() => computeRoofTrim(geometry, { snowGuards }), [geometry, snowGuards]);

  const openingsArea = useMemo(() => computeOpeningsArea_m2(openings), [openings]);
  const openingsCost = useMemo(() => computeOpeningsCost(openings), [openings]);

  const envelope = useMemo(() => {
    const grossWallArea = computeWallArea_m2(geometry);
    const wallArea = Math.max(0, grossWallArea - openingsArea);
    const roofArea = computeRoofArea_m2(geometry);
    return { grossWallArea, wallArea, roofArea };
  }, [geometry, openingsArea]);

  // «Макс шаг прогонов» (вывод!D23): по несущей способности настила при
  // нагрузке на покрытие × 1,15. Ручной ввод (вывод!D24) перекрывает его.
  const maxPurlinStep = useMemo(() => {
    const sg = climate.ok ? climate.value.city.snow.sgKpa : null;
    if (sg === null) return null;
    const byDecking = maxPurlinStepByDecking(
      deckingMark,
      roofLoadForDecking_kPa(sg, defaultRoofSlopeDeg(span)) * 1.15,
    );
    return maxStepOverrideMm > 0 ? maxStepOverrideMm : byDecking;
  }, [climate, deckingMark, span, maxStepOverrideMm]);

  const purlin = useMemo(() => {
    const sg = climate.ok ? climate.value.city.snow.sgKpa : null;
    if (sg === null || maxPurlinStep === null) return null;
    const selfWeight = roofingTypes.find((r) => r.type === roofingType)?.selfWeight_kg_m2 ?? 0;
    return selectPurlin(
      {
        span_m: geometry.span_m,
        framePitch_m: geometry.framePitch_m,
        snowLoad_kPa: sg,
        roofingSelfWeight_kg_m2: selfWeight,
        roofSlopeDeg: geometry.roofSlopeDeg,
        gammaN: responsibility,
        maxStep_mm: maxPurlinStep,
        snowGuardPurlin: snowGuards,
        family: purlinFamilyForRoofing(roofingType),
        insulationThickness_mm: insulationThicknessForRoofing(roofingType),
      },
      geometry.length_m,
    );
  }, [climate, geometry, maxPurlinStep, responsibility, roofingType, snowGuards]);

  const purlinLayout = useMemo(() => {
    if (!purlin) return null;
    return computePurlinLayout(purlin, geometry.span_m, geometry.length_m, {
      snowGuardPurlin: snowGuards,
    });
  }, [purlin, geometry, snowGuards]);

  // Строки ведомости, у которых количество считается, а стоимость не заведена.
  const unpricedSections = useMemo(() => {
    const wall = computeWallUnpricedItems(geometry);
    const roof = purlinLayout
      ? computeRoofUnpricedItems(geometry, roofThickness, purlinLayout.totalProfileLength_m)
      : null;
    return roof ? [wall, roof] : [wall];
  }, [geometry, roofThickness, purlinLayout]);

  const wallCladding = useMemo(
    () => computeWallCladdingSection(geometry, envelope.wallArea, wallThickness),
    [geometry, envelope.wallArea, wallThickness],
  );

  const roofCladding = useMemo(() => {
    if (!purlinLayout) return null;
    return computeRoofCladdingSection(geometry, envelope.roofArea, roofThickness, purlinLayout.lineCount);
  }, [geometry, envelope.roofArea, roofThickness, purlinLayout]);

  const facadePost = useMemo(() => {
    if (!climate.ok || climate.value.city.wind.w0Kpa === null) return undefined;
    return selectFacadePost({
      w0_kPa: climate.value.city.wind.w0Kpa,
      postSpacing_m: postSpacing,
      height_m: height,
    });
  }, [climate, postSpacing, height]);

  const facadePostLayout = useMemo(() => {
    if (!facadePost) return null;
    // Количество — по практическому правилу (не из формул исходного
    // файла ИНСИ, см. facadePost/postCount.ts), не по периметру/шагу.
    // Шаг стоек (postSpacing) используется только для расчёта нагрузки
    // на одну стойку при подборе сечения (см. selectFacadePost) — с
    // количеством он намеренно не связан.
    const postCount = facadePostCount(span);
    const totalLength_m = postCount * geometry.height_m;
    const totalMass_kg = totalLength_m * facadePost.profile.mass_kg_per_m;
    return { postCount, totalLength_m, totalMass_kg };
  }, [facadePost, geometry, span]);

  const commercial = useMemo(() => {
    // Раскладка по статьям исходной ведомости (строки 155–160).
    // «Каркас» = F32 + F100: профили рамы, прогоны, прочие профили,
    // весь крепёж и связи. Связи считаются, но «Лист» (фасонки) требует
    // веса фасонок на раму, который известен не для всех пролётов.
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

    // «Стеновое ограждение» = F44 + F114, «Кровельное» = F147 + F70 + F81.
    // Эти разделы уже включают свои 2% внутри модулей.
    const wallMaterials = wallCladding.totalCost != null ? wallCladding.totalCost + wallTrim.totalCost : null;
    const roofMaterials =
      roofCladding?.totalCost != null
        ? roofCladding.totalCost + drainage.totalCost + roofTrim.totalCost
        : null;

    return computeCommercialSummary({
      frameMaterials,
      wallMaterials,
      roofMaterials,
      openingsCost: openingsCost.totalCost,
      frameMissing: bracing?.missing,
    });
  }, [
    frameTakeoff,
    bracing,
    frameExtras,
    frameFasteners,
    purlinLayout,
    wallCladding,
    wallTrim,
    roofCladding,
    drainage,
    roofTrim,
    openingsCost,
  ]);

  const summary = useMemo(() => {
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
      frameTakeoff?.totalFrameMass_kg !== null &&
      frameFasteners !== null &&
      bracing?.totalMass_kg != null &&
      purlinLayout?.totalMass_kg !== null &&
      facadePostLayout?.totalMass_kg !== null;

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
    // климата (только от геометрии) и обычно доминирует, из-за чего
    // при смене города меняется в основном "невидимая на глаз" часть
    // (каркас+прогоны), а итоговая сумма почти не сдвигается.
    const shareOf = (cost: number | null | undefined) =>
      cost != null && knownCost > 0 ? (cost / knownCost) * 100 : null;
    const shares = {
      frame: shareOf(frameTakeoff?.totalFrameCost),
      purlin: shareOf(purlinLayout?.totalCost),
      cladding: shareOf(claddingCost),
      drainage: shareOf(drainage.totalCost),
      fasteners: shareOf(frameFasteners?.totalCost),
      bracing: shareOf(bracing?.totalCost),
      roofTrim: shareOf(roofTrim.totalCost),
      profiles: shareOf((frameExtras?.totalCost ?? 0) + wallTrim.totalCost),
    };

    return {
      steelMass_kg,
      claddingMass_kg,
      hasFullSteelMass,
      claddingCost,
      knownCost,
      hasFullCost,
      shares,
    };
  }, [
    frameTakeoff,
    frameFasteners,
    bracing,
    horizTiesMass_kg,
    frameExtras,
    wallTrim,
    drainage,
    roofTrim,
    purlinLayout,
    facadePostLayout,
    wallCladding,
    roofCladding,
  ]);

  return (
    <div className="page">
      <header>
        <h1>СпринтМ</h1>
        <p className="subtitle">Предварительный расчёт ангара ИНСИ — подбор сечений рамы</p>
      </header>

      <section className="card">
        <h2>Исходные данные</h2>
        <div className="form-grid">
          <label>
            Город
            <input
              list="settlements"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Начните вводить название"
            />
            <datalist id="settlements">
              {settlementNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label>
            Пролёт, м
            <select value={span} onChange={(e) => setSpan(Number(e.target.value) as Span)}>
              {SPANS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Длина, м
            <input
              type="number"
              step="0.5"
              min="1"
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
          </label>

          <label>
            Высота, м
            <input
              type="number"
              step="0.1"
              min="1"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>

          <label>
            Уровень ответственности
            <select
              value={responsibility}
              onChange={(e) => setResponsibility(Number(e.target.value) as ResponsibilityLevel)}
            >
              <option value={1.0}>II (k = 1,0)</option>
              <option value={0.8}>III (k = 0,8)</option>
            </select>
          </label>

          <label>
            Тип кровли (для веса прогонов)
            <select value={roofingType} onChange={(e) => setRoofingType(e.target.value)}>
              {roofingTypes.map((r) => (
                <option key={r.type} value={r.type}>
                  {r.type} ({r.selfWeight_kg_m2} кг/м²)
                </option>
              ))}
            </select>
          </label>

          <label>
            Марка настила (ограничивает шаг прогонов)
            <select value={deckingMark} onChange={(e) => setDeckingMark(e.target.value)}>
              {DECKING_MARKS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label>
            Макс. шаг прогонов, мм (0 — по настилу)
            <input
              type="number"
              step="50"
              min="0"
              value={maxStepOverrideMm}
              onChange={(e) => setMaxStepOverrideMm(Number(e.target.value))}
            />
          </label>

          <label>
            Сэндвич-панель стены, мм
            <select value={wallThickness} onChange={(e) => setWallThickness(Number(e.target.value))}>
              {getSandwichPanelThicknesses().map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label>
            Сэндвич-панель кровли, мм
            <select value={roofThickness} onChange={(e) => setRoofThickness(Number(e.target.value))}>
              {getSandwichPanelThicknesses().map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ворота (шт × Ш × В, м)
            <div className="inline-fields">
              <input
                type="number"
                min="0"
                value={openings.gatesCount}
                onChange={(e) => setOpenings({ ...openings, gatesCount: Number(e.target.value) })}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={openings.gateWidth_m}
                onChange={(e) => setOpenings({ ...openings, gateWidth_m: Number(e.target.value) })}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={openings.gateHeight_m}
                onChange={(e) => setOpenings({ ...openings, gateHeight_m: Number(e.target.value) })}
              />
            </div>
          </label>

          <label>
            Двери (шт × Ш × В, м)
            <div className="inline-fields">
              <input
                type="number"
                min="0"
                value={openings.doorsCount}
                onChange={(e) => setOpenings({ ...openings, doorsCount: Number(e.target.value) })}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={openings.doorWidth_m}
                onChange={(e) => setOpenings({ ...openings, doorWidth_m: Number(e.target.value) })}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={openings.doorHeight_m}
                onChange={(e) => setOpenings({ ...openings, doorHeight_m: Number(e.target.value) })}
              />
            </div>
          </label>

          <label>
            Окна (шт × Ш × В, м)
            <div className="inline-fields">
              <input
                type="number"
                min="0"
                value={openings.windowsCount}
                onChange={(e) => setOpenings({ ...openings, windowsCount: Number(e.target.value) })}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={openings.windowWidth_m}
                onChange={(e) => setOpenings({ ...openings, windowWidth_m: Number(e.target.value) })}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={openings.windowHeight_m}
                onChange={(e) => setOpenings({ ...openings, windowHeight_m: Number(e.target.value) })}
              />
            </div>
          </label>

          <label>
            Распорки из трубы (шт / профиль)
            <div className="inline-fields">
              <input
                type="number"
                min="0"
                value={tubeStrutCount}
                onChange={(e) => setTubeStrutCount(Number(e.target.value))}
              />
              <select value={strutTube} onChange={(e) => setStrutTube(e.target.value as StrutTube)}>
                <option value="60х3">60х3</option>
                <option value="80х3">80х3</option>
                <option value="120х3">120х3</option>
              </select>
            </div>
          </label>

          <label>
            Добавка к конструкциям из труб, т
            <input
              type="number"
              min="0"
              step="0.001"
              value={extraTubeMass_t}
              onChange={(e) => setExtraTubeMass(Number(e.target.value))}
            />
          </label>

          <label>
            Шаг стоек фахверка, м
            <input
              type="number"
              min="0.5"
              step="0.1"
              value={postSpacing}
              onChange={(e) => setPostSpacing(Number(e.target.value))}
            />
          </label>
          <label>
            Снегозадержатель
            <select
              value={snowGuards ? "есть" : "нет"}
              onChange={(e) => setSnowGuards(e.target.value === "есть")}
            >
              <option value="есть">есть</option>
              <option value="нет">нет</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Климат</h2>
        {climate.ok ? (
          <dl className="result-list">
            <dt>Населённый пункт</dt>
            <dd>
              {climate.value.city.settlement}, {climate.value.city.region}
            </dd>
            <dt>Снеговой район</dt>
            <dd>
              {climate.value.city.snow.region} ({climate.value.city.snow.sgKpa} кПа)
            </dd>
            <dt>Ветровой район</dt>
            <dd>
              {climate.value.city.wind.region} ({climate.value.city.wind.w0Kpa} кПа)
            </dd>
            <dt>Код "с/в"</dt>
            <dd>
              {climate.value.raw}
              {climate.value.raw !== climate.value.standard && (
                <> &rarr; нормализован к {climate.value.standard}</>
              )}
            </dd>
          </dl>
        ) : (
          <p className="error">{climate.error}</p>
        )}
      </section>

      <section className="card">
        <h2>Сечения рамы</h2>
        {heightBucket !== null && (
          <p className="hint">Высота {height}м приведена к расчётной корзине {heightBucket}м.</p>
        )}
        {!climate.ok ? (
          <p className="error">Нет данных по климату — сечения не рассчитаны.</p>
        ) : frame?.ok === false ? (
          <p className="error">{frame.error}</p>
        ) : frame?.value ? (
          <dl className="result-list">
            <dt>Колонна</dt>
            <dd>
              {frame.value.column.profile} ({frame.value.column.utilizationPercent}% использования)
            </dd>
            <dt>Балка</dt>
            <dd>
              {frame.value.beam.profile} ({frame.value.beam.utilizationPercent}% использования)
            </dd>
            <dt>Прогоны</dt>
            <dd>{frame.value.purlin ? frame.value.purlin.profile : "—"}</dd>
            <dt>Шаг рам</dt>
            <dd>{frame.value.framePitch_m} м</dd>
            <dt>Болты М16 в раме</dt>
            <dd>{frame.value.bolts.totalInFrame} шт.</dd>
          </dl>
        ) : (
          <p className="error">
            Комбинация пролёт={span}м, высота={heightBucket}м, k={responsibility}, с/в=
            {climate.value.standard} не найдена в банке сечений.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Ведомость материалов каркаса</h2>
        <p className="hint">
          Только колонны и балки (ригели); прогоны, связи, крепёж и обшивка — в разработке.
        </p>
        {frameTakeoff ? (
          <>
            <dl className="result-list">
              <dt>Кол-во рам</dt>
              <dd>{frameTakeoff.frameCount} шт.</dd>
              <dt>Колонны</dt>
              <dd>
                {frameTakeoff.column.totalLength_m.toFixed(1)} м
                {frameTakeoff.column.totalMass_kg !== null
                  ? ` — ${frameTakeoff.column.totalMass_kg.toFixed(0)} кг`
                  : " — масса неизвестна (нет в прайс-листе)"}
              </dd>
              <dt>Балки</dt>
              <dd>
                {frameTakeoff.beam.totalLength_m.toFixed(1)} м
                {frameTakeoff.beam.totalMass_kg !== null
                  ? ` — ${frameTakeoff.beam.totalMass_kg.toFixed(0)} кг`
                  : " — масса неизвестна (нет в прайс-листе)"}
              </dd>
              {frameExtras?.items.map((item) => (
                <Fragment key={item.name}>
                  <dt>{item.name}</dt>
                  <dd>
                    {item.count.toFixed(1)} {item.unit} — {item.mass_kg.toFixed(1)} кг —{" "}
                    {Math.round(item.cost).toLocaleString("ru-RU")} ₽
                  </dd>
                </Fragment>
              ))}
              {frameFasteners?.items.map((item) => (
                <Fragment key={item.name}>
                  <dt>{item.name}</dt>
                  <dd>
                    {Math.round(item.count)} шт — {item.mass_kg.toFixed(1)} кг —{" "}
                    {Math.round(item.cost).toLocaleString("ru-RU")} ₽
                    {item.isEstimated ? " (ставка не подтверждена для этого пролёта)" : ""}
                  </dd>
                </Fragment>
              ))}
              {bracing?.items.map((item) => (
                <Fragment key={item.name}>
                  <dt>{item.name}</dt>
                  <dd>
                    {item.mass_t === null || item.cost === null ? (
                      <span className="incomplete">нет веса фасонок для этого пролёта</span>
                    ) : (
                      <>
                        {item.mass_t.toFixed(3)} т — {Math.round(item.cost).toLocaleString("ru-RU")} ₽
                      </>
                    )}
                  </dd>
                </Fragment>
              ))}
              <dt>Гориз. связи по подборщику</dt>
              <dd className="incomplete">
                {horizTiesMass_kg !== null
                  ? `${horizTiesMass_kg.toFixed(0)} кг — другой источник, в итог не входит`
                  : "нет данных для этой комбинации"}
              </dd>
              <dt>Итого металл каркаса</dt>
              <dd>
                {frameTakeoff.totalFrameMass_kg !== null
                  ? `${(
                      frameTakeoff.totalFrameMass_kg +
                      (frameFasteners?.totalMass_kg ?? 0) +
                      (frameExtras?.totalMass_kg ?? 0) +
                      (bracing?.totalMass_kg ?? 0)
                    ).toFixed(0)} кг`
                  : "—"}
              </dd>
              <dt>Итого крепёж и профили</dt>
              <dd>
                {frameFasteners
                  ? `${Math.round(
                      frameFasteners.totalCost + (frameExtras?.totalCost ?? 0),
                    ).toLocaleString("ru-RU")} ₽`
                  : "—"}
              </dd>
            </dl>
          </>
        ) : (
          <p className="error">Нет данных для расчёта ведомости.</p>
        )}
      </section>

      <section className="card">
        <h2>Прогоны</h2>
        <p className="hint">
          Повторяет подбор расчётчика: перебор шага 500…3000 мм с шагом 5 мм, отсев профилей с
          коэффициентом использования больше 1 и выбор шага с наименьшей массой стали — отдельно
          по стали МП350 и МП390.
        </p>
        {roofLoad && (
          <p className="hint">
            Нагрузка на кровлю: {roofLoad.total_kg_m2.toFixed(1)} кг/м² ({roofLoad.total_kPa.toFixed(3)}{" "}
            кПа) = снег {roofLoad.snow_kg_m2.toFixed(1)} + ветер {roofLoad.wind_kg_m2.toFixed(1)} + вес
            кровли {roofLoad.dead_kg_m2.toFixed(1)}
          </p>
        )}
        {purlin ? (
          <dl className="result-list">
            <dt>Макс. шаг по настилу</dt>
            <dd>
              {maxPurlinStep} мм{maxStepOverrideMm > 0 ? " (задан вручную)" : ` (${deckingMark})`}
            </dd>
            <dt>Профиль</dt>
            <dd>
              {purlin.profile.name} ({purlin.profile.series})
            </dd>
            <dt>Подобранный шаг</dt>
            <dd>{purlin.step_mm} мм</dd>
            <dt>Расход стали</dt>
            <dd>{purlin.massPerBuildingArea_kg_m2.toFixed(2)} кг/м² здания</dd>
            {purlin.runnerUp && (
              <>
                <dt>Второй вариант</dt>
                <dd>
                  {purlin.runnerUp.profile.name} ({purlin.runnerUp.profile.series}), шаг{" "}
                  {purlin.runnerUp.step_mm} мм — {purlin.runnerUp.massPerBuilding_kg.toFixed(0)} кг
                </dd>
              </>
            )}
            {purlinLayout && (
              <>
                <dt>Линий прогонов</dt>
                <dd>
                  {purlinLayout.lineCount} шт.
                  {snowGuards ? " + прогон под снегозадержание" : ""}
                </dd>
                <dt>Суммарно на здание</dt>
                <dd>
                  {purlinLayout.totalProfileLength_m.toFixed(0)} п.м. —{" "}
                  {purlinLayout.totalMass_kg.toFixed(0)} кг
                  {purlinLayout.totalCost !== null
                    ? ` — ${purlinLayout.totalCost.toLocaleString("ru-RU")} ₽`
                    : " — цена неизвестна"}
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="error">
            {maxPurlinStep === null
              ? "Нет снеговой нагрузки для этого населённого пункта — подбор прогонов невозможен."
              : "Ни один профиль не проходит по несущей способности в допустимом диапазоне шага."}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Не входит в итог расчётчика</h2>
        <p className="hint">
          У этих строк ведомости количество считается, а колонка стоимости оставлена пустой —
          в «Итого стена» и «Итого кровля» они не попадают. Показываю отдельно, чтобы было видно,
          о каких деньгах речь. Утеплитель стены и Изоспан в разделе «Стена» заглушены прямо в
          формуле (×0): стена — сэндвич-панель, утеплитель внутри неё.
        </p>
        {unpricedSections.map((s) => (
          <Fragment key={s.section}>
            <dl className="result-list">
              <dt className="group-heading">{s.section}</dt>
              <dd />
              {s.items.map((i) => (
                <Fragment key={i.name}>
                  <dt>{i.name}</dt>
                  <dd>
                    {i.count.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} {i.unit}{" "}
                    <span className="incomplete">
                      — было бы {Math.round(i.wouldCost).toLocaleString("ru-RU")} ₽
                    </span>
                  </dd>
                </Fragment>
              ))}
              <dt>Итого по разделу</dt>
              <dd className="incomplete">
                {Math.round(s.wouldAddCost).toLocaleString("ru-RU")} ₽ — не в итоге
              </dd>
            </dl>
          </Fragment>
        ))}
      </section>

      <section className="card">
        <h2>Стойки фахверка</h2>
        <p className="hint">
          Сечение — оценочно, проверка только на изгиб от ветра (без гибкости и продольной силы).
          Количество — по практическому правилу (не из формул исходного файла ИНСИ): 4 шт. на
          здание для пролёта до 18м, 6 шт. для 21–24м. Шаг стоек ниже влияет только на нагрузку при
          подборе сечения, на количество — нет.
        </p>
        {facadePost && facadePostLayout ? (
          <dl className="result-list">
            <dt>Профиль</dt>
            <dd>
              {facadePost.profile.section} ({facadePost.profile.steelGrade})
            </dd>
            <dt>Кол-во стоек</dt>
            <dd>{facadePostLayout.postCount} шт.</dd>
            <dt>Суммарно на здание</dt>
            <dd>
              {facadePostLayout.totalLength_m.toFixed(0)} м — {facadePostLayout.totalMass_kg.toFixed(0)}{" "}
              кг
            </dd>
          </dl>
        ) : (
          <p className="error">Нет данных для подбора (проверьте климат) или нагрузка слишком велика.</p>
        )}
      </section>

      <section className="card">
        <h2>Обшивка (сэндвич-панели)</h2>
        <p className="hint">
          Стены — за вычетом площади ворот/дверей ({openingsArea.toFixed(1)} м² из{" "}
          {envelope.grossWallArea.toFixed(1)} м²); окна считаются суммарной площадью, без раскладки
          по фасадам. Площадь кровли — пятно застройки с надбавкой 3% на уклон, как в исходной
          ведомости. Количество саморезов кровли зависит от числа прогонов (в исходнике оно
          вбивается вручную, у нас берётся из подбора).
        </p>
        <dl className="result-list">
          {[
            ["Стены", wallCladding] as const,
            ["Кровля", roofCladding] as const,
          ].map(([label, section]) =>
            section === null ? null : (
              <Fragment key={label}>
                <dt className="group-heading">{label}</dt>
                <dd />
                {section.items.map((item) => (
                  <Fragment key={`${label}-${item.name}`}>
                    <dt>{item.name}</dt>
                    <dd>
                      {item.count.toFixed(1)} {item.unit} — {item.mass_kg.toFixed(1)} кг —{" "}
                      {item.cost !== null
                        ? `${Math.round(item.cost).toLocaleString("ru-RU")} ₽`
                        : "цены нет в прайсе для этой толщины"}
                    </dd>
                  </Fragment>
                ))}
                <dt>Накладные расходы (2%)</dt>
                <dd>
                  {section.overheadCost !== null
                    ? `${Math.round(section.overheadCost).toLocaleString("ru-RU")} ₽`
                    : "—"}
                </dd>
              </Fragment>
            ),
          )}
          <dt>Итого обшивка</dt>
          <dd>
            {summary.claddingCost !== null
              ? `${summary.claddingMass_kg.toFixed(0)} кг — ${Math.round(
                  summary.claddingCost,
                ).toLocaleString("ru-RU")} ₽`
              : "—"}
          </dd>
        </dl>
      </section>

      <section className="card">
        <h2>Стены — угловые элементы</h2>
        <p className="hint">
          Раздел «Стены» исходной ведомости целиком: остальные его позиции (ПС 245х65, окрашенные
          профили, С-18, КФ) в обоих проектах обнулены. Делитель 1,9 в формулах — рабочая длина
          двухметрового элемента за вычетом нахлёста.
        </p>
        <dl className="result-list">
          {wallTrim.items.map((item) => (
            <Fragment key={item.name}>
              <dt>{item.name}</dt>
              <dd>
                {item.count.toFixed(1)} {item.unit} — {item.mass_kg.toFixed(1)} кг —{" "}
                {Math.round(item.cost).toLocaleString("ru-RU")} ₽
              </dd>
            </Fragment>
          ))}
          <dt>Накладные расходы (2%)</dt>
          <dd>{Math.round(wallTrim.overheadCost).toLocaleString("ru-RU")} ₽</dd>
          <dt>Итого стены</dt>
          <dd>
            {wallTrim.totalMass_kg.toFixed(1)} кг —{" "}
            {Math.round(wallTrim.totalCost).toLocaleString("ru-RU")} ₽
          </dd>
        </dl>
      </section>

      <section className="card">
        <h2>Кровля — доборные элементы</h2>
        <p className="hint">
          Формулы и цены подтверждены дословным совпадением в обеих исходных ведомостях.
          Снегозадержатель включается вручную — в исходнике это множитель 0/1 у строки, ему
          соответствует поле «Прогон под снегозадержание» в подборе. Профлистовые варианты обшивки
          (С-18, С-44, вент. конька) в обоих проектах отключены, поэтому их здесь нет.
        </p>
        <dl className="result-list">
          {roofTrim.items.map((item) => (
            <Fragment key={item.name}>
              <dt>{item.name}</dt>
              <dd>
                {item.count.toFixed(item.count % 1 === 0 ? 0 : 1)} {item.unit} —{" "}
                {item.mass_kg.toFixed(1)} кг — {Math.round(item.cost).toLocaleString("ru-RU")} ₽
              </dd>
            </Fragment>
          ))}
          <dt>Накладные расходы (2%)</dt>
          <dd>{Math.round(roofTrim.overheadCost).toLocaleString("ru-RU")} ₽</dd>
          <dt>Итого кровля</dt>
          <dd>
            {roofTrim.totalMass_kg.toFixed(1)} кг —{" "}
            {Math.round(roofTrim.totalCost).toLocaleString("ru-RU")} ₽
          </dd>
        </dl>
      </section>

      <section className="card">
        <h2>Водосток (ф150мм)</h2>
        <p className="hint">
          Формулы подтверждены дословным совпадением в обеих исходных ведомостях. Цены — из прайса
          ИНСИ на водосток, актуальны на дату исходных файлов. Дробные количества держателей и
          соединителей исходник не округляет — оставлено как есть.
        </p>
        <dl className="result-list">
          {drainage.items.map((item) => (
            <Fragment key={item.name}>
              <dt>{item.name}</dt>
              <dd>
                {item.count.toFixed(item.count % 1 === 0 ? 0 : 1)} {item.unit} —{" "}
                {item.mass_kg.toFixed(1)} кг — {Math.round(item.cost).toLocaleString("ru-RU")} ₽
              </dd>
            </Fragment>
          ))}
          <dt>Накладные расходы (2%)</dt>
          <dd>{Math.round(drainage.overheadCost).toLocaleString("ru-RU")} ₽</dd>
          <dt>Итого водосток</dt>
          <dd>
            {drainage.totalMass_kg.toFixed(1)} кг —{" "}
            {Math.round(drainage.totalCost).toLocaleString("ru-RU")} ₽
          </dd>
        </dl>
      </section>

      <section className="card summary-card">
        <h2>Итоговая сводка</h2>
        <p className="hint">
          Структура — как в коммерческой части исходной ведомости: три статьи материалов с
          упаковкой 2%, проёмы отдельной строкой сверх неё.
        </p>
        <dl className="result-list">
          {commercial.lines.map((line) => (
            <Fragment key={line.name}>
              <dt>{line.name}</dt>
              <dd>
                {line.cost !== null
                  ? Math.round(line.cost).toLocaleString("ru-RU") + " ₽"
                  : "—"}
                {line.missing && (
                  <span className="incomplete"> без {line.missing}</span>
                )}
              </dd>
            </Fragment>
          ))}
          <dt>Итого предложение</dt>
          <dd className="summary-total">
            {commercial.totalCost !== null
              ? Math.round(commercial.totalCost).toLocaleString("ru-RU") + " ₽"
              : "—"}
            {commercial.lines.some((l) => l.missing) && (
              <span className="incomplete"> — занижено, см. выше</span>
            )}
          </dd>
          <dt className="group-heading">Справочно</dt>
          <dd />
          <dt>Металл (каркас, прогоны, стойки)</dt>
          <dd>
            {summary.steelMass_kg.toFixed(0)} кг
            {!summary.hasFullSteelMass && " (частично — см. предупреждения выше)"}
          </dd>
          <dt>Обшивка</dt>
          <dd>{summary.claddingMass_kg.toFixed(0)} кг</dd>
          <dt>Материалы без упаковки</dt>
          <dd>
            {commercial.materialsWithPackaging !== null
              ? `${Math.round(commercial.materialsWithPackaging / 1.02).toLocaleString("ru-RU")} ₽`
              : "—"}
          </dd>
        </dl>
        <p className="hint">
          В статью «Каркас» ещё не входят связи — трубы, уголок и лист, — поэтому она показана
          неполной. Не учтено также: затяжки, вертикальные связи фахверка, утеплитель и
          пароизоляция, ГВЛ, цена узловых пластин и горизонтальных связей (только масса), стойки
          фахверка (только масса), проектные работы и монтаж. Это предварительная оценка, не
          коммерческое предложение.
        </p>
      </section>

      <footer>
        <p>
          Данные подобраны по банку сечений, извлечённому из исходных Excel-калькуляторов ИНСИ.
          Прайс-лист актуален на даты, указанные в исходных файлах (разные разделы обновлялись в
          разное время).
        </p>
      </footer>
    </div>
  );
}
