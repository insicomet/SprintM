import { Fragment, useMemo, useState } from "react";
import { getAllSettlementNames, getSupportedSvCodes } from "./calc/climate/svCode";
import { getSandwichPanelThicknesses } from "./calc/cladding/sandwichPanel";
import type { StrutTube } from "./calc/frame/bracing";
import { heightLimitsForSpan } from "./calc/frame/sectionBank";
import { WIND_DISTRICTS, windPressureForDistrict_kPa } from "./calc/climate/manualClimate";
import { DEFAULT_OPENINGS, type OpeningsInput } from "./calc/geometry/openings";
import { buildBill } from "./calc/bill/buildBill";
import { computeProject } from "./calc/project/computeProject";
import { DECKING_MARKS, DEFAULT_DECKING_MARK } from "./calc/purlin/deckingSpan";
import roofingTypesRaw from "./data/roofingSelfWeight.json";
import { SPANS, type ResponsibilityLevel, type Span } from "./types/common";

// Одноимённые города (два Берёзовских, два Гурьевска и т.п.) приходят
// уже в уточнённой форме "Город, Регион", поэтому список уникален и
// позволяет выбрать нужный осознанно.
const settlementNames = getAllSettlementNames();

const roofingTypes = roofingTypesRaw as { type: string; selfWeight_kg_m2: number }[];

/** Коды «с/в», для которых в банке сечений ИНСИ есть просчитанные строки. */
const SV_CODES = getSupportedSvCodes();

/**
 * Наименьшая высота, которую вообще пускаем в поле. Банк снизу не
 * ограничен — всё, что ниже первой корзины, считается по ней, — но
 * ангар ниже трёх метров смысла не имеет.
 */
const MIN_HEIGHT_M = 3;

/** 6 → «6», 6.2 → «6,2»: в поле высоты дробная часть бывает, а нули не нужны. */
const fmt = (v: number) => String(v).replace(".", ",");

export function App() {
  const [city, setCity] = useState("Челябинск");
  // Ручной ввод нагрузок — для площадок, которых нет в справочнике.
  const [manualMode, setManualMode] = useState(false);
  const [manualSnow, setManualSnow] = useState(1.5);
  const [manualWind, setManualWind] = useState("II");
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
  // Количество распорок в исходнике вбито руками; сечение выводится
  // правилом подборщика, пустое значение — «по правилу».
  const [tubeStrutCount, setTubeStrutCount] = useState(3);
  const [strutTube, setStrutTube] = useState<StrutTube | "">("");
  // 0 — выводим сами из проёмов (вывод!E68), см. openingsFraming.
  const [extraTubeMass_t, setExtraTubeMass] = useState(0);
  // Шаг рам вручную (вывод!D9): расчётчик задаёт его при некратной длине.
  const [framePitchOverride, setFramePitchOverride] = useState(0);
  // Прогон под ограждение (вывод!D27) и мин. шаг прогонов (вывод!D25).
  const [railingPurlin, setRailingPurlin] = useState(false);
  const [minStepMm, setMinStepMm] = useState(0);
  // Код "с/в" вручную — только для сверки с файлом расчётчика.
  const [svOverride, setSvOverride] = useState("");
  // Блок банка сечений (подбор!W9) — в исходнике это ОТДЕЛЬНАЯ величина от
  // γn (вывод!D7): в "22316" γn = 1, а сечения взяты из блока k = 0,8.
  const [bankK, setBankK] = useState<"auto" | ResponsibilityLevel>("auto");
  // Снеговая нагрузка вручную — подборщик для части городов берёт
  // уточнённое значение ГМЦ, которого в нашей базе нет (Сургут: 1,8 против 2,0).
  const [snowOverrideKpa, setSnowOverrideKpa] = useState(0);
  // «Спринт с СГ по Р» — вариант со шпренгельной затяжкой, только 24 м.
  const [trussedVariant, setTrussedVariant] = useState(false);
  // Раздел «Перекрытие» — в ведомости он есть, но его итог обнулён.
  const [mezzanine, setMezzanine] = useState(false);

  const project = useMemo(
    () =>
      computeProject({
        city,
        manualClimate: manualMode
          ? { snowLoad_kPa: manualSnow, windDistrict: manualWind, label: city }
          : undefined,
        span,
        length_m: length,
        height_m: height,
        gammaN: responsibility,
        bankK,
        svOverride,
        snowLoadOverride_kPa: snowOverrideKpa,
        roofingType,
        deckingMark,
        maxStepOverride_mm: maxStepOverrideMm,
        minStep_mm: minStepMm,
        framePitchOverride_m: framePitchOverride,
        wallPanel_mm: wallThickness,
        roofPanel_mm: roofThickness,
        openings,
        snowGuards,
        railingPurlin,
        tubeStrutCount,
        strutTube: strutTube || undefined,
        extraTubeMass_t: extraTubeMass_t || undefined,
        postSpacing_m: postSpacing,
        trussedVariant,
        mezzanine,
      }),
    [
      city,
      manualMode,
      manualSnow,
      manualWind,
      span,
      length,
      height,
      responsibility,
      bankK,
      svOverride,
      snowOverrideKpa,
      roofingType,
      deckingMark,
      maxStepOverrideMm,
      minStepMm,
      framePitchOverride,
      wallThickness,
      roofThickness,
      openings,
      snowGuards,
      railingPurlin,
      tubeStrutCount,
      strutTube,
      extraTubeMass_t,
      postSpacing,
      trussedVariant,
      mezzanine,
    ],
  );

  const {
    climate,
    bankBlock,
    bankBlockMissing,
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
    facadePost,
    facadePostLayout,
    commercial,
    summary,
  } = project;

  // Ограничение из подборщика (лист «вывод», E6): «пролет 21 до высоты
  // 6,2м; пролет 21,1-24 высота до 9 м». Берём его из банка сечений,
  // чтобы поле и подбор не разошлись.
  const heightLimits = heightLimitsForSpan(span);
  const heightTooHigh = height > heightLimits.max_m;

  const bill = useMemo(() => buildBill(project), [project]);

  // Сколько ручных переопределений включено — чтобы свёрнутый блок не прятал их молча.
  const overrideCount =
    (snowOverrideKpa > 0 ? 1 : 0) + (svOverride ? 1 : 0) + (bankK !== "auto" ? 1 : 0);

  return (
    <div className="page">
      <header>
        <h1>СпринтМ</h1>
        <p className="subtitle">Предварительный расчёт ангара ИНСИ — подбор сечений рамы</p>
      </header>

      <section className="card">
        <h2>Объект</h2>
        <div className="form-grid">
          <label className="span-2">
            {manualMode ? "Площадка" : "Город"}
            <input
              list={manualMode ? undefined : "settlements"}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={manualMode ? "Название для расчёта" : "Начните вводить название"}
            />
            <datalist id="settlements">
              {settlementNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <span className="field-hint">
              {manualMode ? (
                <>
                  Нагрузки заданы вручную — из справочника ничего не берётся.{" "}
                  <button type="button" className="linklike" onClick={() => setManualMode(false)}>
                    вернуться к справочнику
                  </button>
                </>
              ) : (
                <>
                  Из него берутся снеговая и ветровая нагрузки — от них зависят сечения.{" "}
                  <button type="button" className="linklike" onClick={() => setManualMode(true)}>
                    нет в справочнике — ввести вручную
                  </button>
                </>
              )}
            </span>
          </label>

          {manualMode && (
            <>
              <label>
                Снеговая нагрузка Sg, кН/м²
                <input
                  type="number"
                  min="0.1"
                  step="0.05"
                  value={manualSnow}
                  onChange={(e) => setManualSnow(Number(e.target.value))}
                />
                <span className="field-hint">
                  Снеговой район не спрашиваем: его выводит лестница нагрузок ИНСИ.
                </span>
              </label>

              <label>
                Ветровой район
                <select value={manualWind} onChange={(e) => setManualWind(e.target.value)}>
                  {WIND_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d} — w₀ {windPressureForDistrict_kPa(d)} кН/м²
                    </option>
                  ))}
                </select>
                <span className="field-hint">По СП 20.13330, карта 2.</span>
              </label>
            </>
          )}

          <label>
            Пролёт, м
            <select
              value={span}
              onChange={(e) => {
                const next = Number(e.target.value) as Span;
                setSpan(next);
                // Вариант «СГ по Р» есть только на 24 м — иначе он повис бы
                // включённым и давал вечное предупреждение.
                if (next !== 24) setTrussedVariant(false);
              }}
            >
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
              min="6"
              step="1"
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
          </label>

          <label>
            Высота, м
            <input
              type="number"
              min={MIN_HEIGHT_M}
              max={heightLimits.max_m}
              step="0.1"
              value={height}
              aria-invalid={heightTooHigh || undefined}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
            <span className={`field-hint${heightTooHigh ? " invalid" : ""}`}>
              {heightTooHigh
                ? `Банк сечений держит для пролёта ${span} м только до ${fmt(heightLimits.max_m)} м`
                : heightBucket !== null && height < heightLimits.minBucket_m
                  ? `Ниже наименьшей корзины — считается по ${fmt(heightBucket)} м`
                  : heightBucket !== null
                    ? `Расчётная корзина банка: ${fmt(heightBucket)} м · для пролёта ${span} м до ${fmt(heightLimits.max_m)} м`
                    : `Для пролёта ${span} м банк держит до ${fmt(heightLimits.max_m)} м`}
            </span>
          </label>

          <label>
            Уровень ответственности γn
            <select
              value={responsibility}
              onChange={(e) => setResponsibility(Number(e.target.value) as ResponsibilityLevel)}
            >
              <option value={1.0}>II (γn = 1,0)</option>
              <option value={0.8}>III (γn = 0,8)</option>
            </select>
            <span className="field-hint">Идёт в нагрузки. Блок банка k подбирается сам.</span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Ограждение</h2>
        <div className="form-grid">
          <label className="span-2">
            Покрытие кровли
            <select value={roofingType} onChange={(e) => setRoofingType(e.target.value)}>
              {roofingTypes.map((r) => (
                <option key={r.type} value={r.type}>
                  {r.type} ({r.selfWeight_kg_m2} кг/м²)
                </option>
              ))}
            </select>
            <span className="field-hint">
              Влияет и на вес прогонов, и на надбавку к снеговой нагрузке.
            </span>
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

          <label className="span-2">
            Марка настила
            <select value={deckingMark} onChange={(e) => setDeckingMark(e.target.value)}>
              {DECKING_MARKS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Ограничивает максимальный шаг прогонов
              {maxPurlinStep !== null && maxStepOverrideMm === 0 ? `: сейчас ${maxPurlinStep} мм` : ""}
            </span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Проёмы</h2>
        <p className="hint">Количество × ширина × высота, м. Вычитаются из площади стен.</p>
        <div className="form-grid">
          <label>
            Ворота
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
            Двери
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
            Окна
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
            Всего проёмов
            <output className="readonly-field">{openingsArea.toFixed(1)} м²</output>
            <span className="field-hint">
              Стена под обшивку: {envelope.wallArea.toFixed(1)} из {envelope.grossWallArea.toFixed(1)} м²
            </span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Кровля и прогоны</h2>
        <div className="form-grid">
          <label>
            Снегозадержатель
            <select
              value={snowGuards ? "есть" : "нет"}
              onChange={(e) => setSnowGuards(e.target.value === "есть")}
            >
              <option value="есть">есть</option>
              <option value="нет">нет</option>
            </select>
            <span className="field-hint">Добавляет прогон и строку доборных элементов.</span>
          </label>

          <label>
            Прогон под ограждение
            <select
              value={railingPurlin ? "есть" : "нет"}
              onChange={(e) => setRailingPurlin(e.target.value === "есть")}
            >
              <option value="нет">нет</option>
              <option value="есть">есть</option>
            </select>
          </label>

          <label>
            Шаг рам, м
            <input
              type="number"
              min="0"
              step="0.5"
              value={framePitchOverride}
              onChange={(e) => setFramePitchOverride(Number(e.target.value))}
            />
            <span className="field-hint">
              0 — из банка сечений{framePitchOverride === 0 ? ` (${geometry.framePitch_m} м)` : ""}
            </span>
          </label>

          <label>
            Макс. шаг прогонов, мм
            <input
              type="number"
              step="50"
              min="0"
              value={maxStepOverrideMm}
              onChange={(e) => setMaxStepOverrideMm(Number(e.target.value))}
            />
            <span className="field-hint">0 — по несущей способности настила</span>
          </label>

          <label>
            Мин. шаг прогонов, мм
            <input
              type="number"
              min="0"
              step="50"
              value={minStepMm}
              onChange={(e) => setMinStepMm(Number(e.target.value))}
            />
            <span className="field-hint">0 — без ограничения снизу</span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Связи, фахверк, перекрытие</h2>
        <div className="form-grid">
          <label>
            Распорки из трубы (шт / профиль)
            <div className="inline-fields">
              <input
                type="number"
                min="0"
                value={tubeStrutCount}
                onChange={(e) => setTubeStrutCount(Number(e.target.value))}
              />
              <select
                value={strutTube}
                onChange={(e) => setStrutTube(e.target.value as StrutTube | "")}
              >
                <option value="">по правилу подборщика</option>
                <option value="60х3">60х3</option>
                <option value="80х3">80х3</option>
                <option value="120х3">120х3</option>
              </select>
            </div>
            <span className="field-hint">
              Количество в обоих реальных проектах — 3 шт.; сечение подборщик выводит по шагу рам
              (≤ 4 м — 60х3, иначе 80х3), сейчас {effectiveStrutTube}.
            </span>
          </label>

          <label>
            Обрамление проёмов, т
            <input
              type="number"
              min="0"
              step="0.001"
              value={extraTubeMass_t}
              onChange={(e) => setExtraTubeMass(Number(e.target.value))}
            />
            <span className={`field-hint${!openingsFraming.complete && extraTubeMass_t === 0 ? " invalid" : ""}`}>
              {extraTubeMass_t > 0
                ? `Задано вручную; по воротам и дверям вышло бы ${openingsFraming.total_t.toFixed(5)} т`
                : openingsFraming.complete
                  ? `0 — считаем сами: ${openingsFraming.total_t.toFixed(5)} т (ворота и двери)`
                  : "В проекте есть окна: их перемычки подбирает подборщик — впишите его «МЕ окон, ворот, дверей» (вывод!E68)"}
            </span>
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
            <span className="field-hint">Влияет только на подбор сечения стойки.</span>
          </label>

          <label>
            Перекрытие
            <select
              value={mezzanine ? "есть" : "нет"}
              onChange={(e) => setMezzanine(e.target.value === "есть")}
            >
              <option value="нет">нет</option>
              <option value="есть">есть</option>
            </select>
            <span className="field-hint">В ведомости раздел есть, но его итог обнулён.</span>
          </label>

          {span === 24 && (
            <label>
              Спринт с СГ по Р
              <select
                value={trussedVariant ? "да" : "нет"}
                onChange={(e) => setTrussedVariant(e.target.value === "да")}
              >
                <option value="нет">нет</option>
                <option value="да">да</option>
              </select>
              <span className="field-hint">Вариант со шпренгельной затяжкой, только 24 м.</span>
            </label>
          )}
        </div>
      </section>

      <details className="card overrides">
        <summary>
          Ручные переопределения
          {overrideCount > 0 && <span className="badge">{overrideCount}</span>}
        </summary>
        <p className="hint">
          Нужны, чтобы сверить расчёт с конкретным файлом расчётчика. В обычной работе не трогайте:
          снег берётся из нашей базы, а район и k выводит лестница нагрузок.
        </p>
        <div className="form-grid">
          <label>
            Снег, кН/м²
            <input
              type="number"
              min="0"
              step="0.1"
              value={snowOverrideKpa}
              onChange={(e) => setSnowOverrideKpa(Number(e.target.value))}
            />
            <span className="field-hint">0 — из нашей базы</span>
          </label>

          <label>
            Код «с/в»
            <select value={svOverride} onChange={(e) => setSvOverride(e.target.value)}>
              <option value="">по лестнице нагрузок</option>
              {SV_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            Блок банка сечений k
            <select
              value={String(bankK)}
              onChange={(e) =>
                setBankK(
                  e.target.value === "auto"
                    ? "auto"
                    : (Number(e.target.value) as ResponsibilityLevel),
                )
              }
            >
              <option value="auto">по лестнице нагрузок</option>
              <option value="1">k = 1,0</option>
              <option value="0.8">k = 0,8</option>
            </select>
          </label>
        </div>
      </details>

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
              {climate.value.city.snow.region ?? (
                <span className="incomplete">задан нагрузкой</span>
              )}{" "}
              ({climate.value.city.snow.sgKpa} кПа)
              {project.snowOverridden && (
                <span className="incomplete">
                  {" "}— в расчёт ушло {project.snowLoad_kPa} кПа, задано вручную
                </span>
              )}
            </dd>
            <dt>Ветровой район</dt>
            <dd>
              {climate.value.city.wind.region} ({climate.value.city.wind.w0Kpa} кПа)
            </dd>
            <dt>Блок банка (лестница ИНСИ)</dt>
            <dd>
              {bankBlock ? (
                <>
                  район {bankBlock.snowDistrict}, k = {bankBlock.bankK} — держит{" "}
                  {bankBlock.designLoad_kPa} кПа при нагрузке{" "}
                  {bankBlock.lookupLoad_kPa.toFixed(2)} кПа (снег + {bankBlock.roofingSupplement_kPa}{" "}
                  за покрытие)
                </>
              ) : (
                <span className="incomplete">
                  {bankBlockMissing === "покрытие"
                    ? "для этого покрытия в лестнице нет надбавки — блок банка не определить"
                    : "нагрузка вне лестницы — нужен расчёт конструктора"}
                </span>
              )}
            </dd>
            <dt>Код "с/в"</dt>
            <dd>
              {climate.value.raw}
              {climate.value.raw !== climate.value.standard && (
                <> &rarr; {climate.overridden ? "задан вручную" : "нормализован"}: {climate.value.standard}</>
              )}
              {climate.overridden && (
                <span className="incomplete"> — не из нашей базы</span>
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
        {trussedVariantMissing && (
          <p className="hint incomplete">
            Варианта со связями по Р для этой комбинации в банке нет — считаю по стандартному.
          </p>
        )}
        {!climate.ok ? (
          <p className="error">Нет данных по климату — сечения не рассчитаны.</p>
        ) : frame?.ok === false ? (
          <p className="error">{frame.error}</p>
        ) : frame?.value ? (
          <>
            <div className="table-scroll">
              <table className="bill sections">
                <thead>
                  <tr>
                    <th>Элемент</th>
                    <th>Сечение</th>
                    <th>Сталь</th>
                    <th className="num">% использ.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Балки</td>
                    <td>{frame.value.beam.profile}</td>
                    <td>М.п.350</td>
                    <td className="num">{frame.value.beam.utilizationPercent}</td>
                  </tr>
                  <tr>
                    <td>Колонны</td>
                    <td>{frame.value.column.profile}</td>
                    <td>М.п.350</td>
                    <td className="num">{frame.value.column.utilizationPercent}</td>
                  </tr>
                  <tr>
                    <td>Прогоны</td>
                    <td>{purlin?.profile.name ?? "—"}</td>
                    <td>{purlin ? purlin.profile.series.replace("МП", "М.п.") : ""}</td>
                    <td className="num">—</td>
                  </tr>
                  {secondaryMembers?.derived.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name}</td>
                      <td>
                        {m.section ?? <span className="incomplete">{m.missing}</span>}
                      </td>
                      <td>{m.steel}</td>
                      <td className="num">—</td>
                    </tr>
                  ))}
                  {secondaryMembers?.fixed.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name}</td>
                      <td>{m.section}</td>
                      <td>{m.steel}</td>
                      <td className="num">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="result-list">
              <dt>Шаг рам</dt>
              <dd>{frame.value.framePitch_m} м</dd>
              <dt>Болты (по распоряжению №40)</dt>
              <dd>
                балки конёк {frame.value.bolts.beamRidge} · балки карниз{" "}
                {frame.value.bolts.beamEave} · колонны опора {frame.value.bolts.columnBase} ·
                колонны карниз {frame.value.bolts.columnEave} — всего{" "}
                <strong>{frame.value.bolts.totalInFrame}</strong>
              </dd>
              <dt>Затяжка к карнизной фасонке, М16</dt>
              <dd>4 шт. (200 кН)</dd>
              <dt>Вес фасонок</dt>
              <dd>
                {frame.value.massGussetPlates_kg !== null
                  ? `${frame.value.massGussetPlates_kg} кг на раму`
                  : "нет в банке"}
              </dd>
            </dl>
            <p className="hint">
              Затяжки, распорки, связи и стойки фахверка подборщик выводит правилами от пролёта,
              шага рам, длины и снегового района — здесь они посчитаны по ним же. Пластины узлов
              в подборщике вписаны константой.
            </p>
            {span > 21 && (
              <p className="hint incomplete">
                Стойку фахверка при пролёте больше 21 м подборщик считает отдельно на листе «24м» —
                этот расчёт мы ещё не разобрали. И там же он просит горизонтальные связи{" "}
                {secondaryMembers?.derived.find((m) => m.name === "Связи горизонтальные")?.section},
                тогда как в формуле массы ведомости жёстко стоит труба 80х3: массу пока считаем по
                ведомости. Оба места — вопрос расчётчику.
              </p>
            )}
          </>
        ) : (
          <p className="error">
            Комбинация пролёт={span}м, высота={heightBucket}м, k=
            {bankK === "auto" ? (bankBlock?.bankK ?? responsibility) : bankK}, с/в=
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
              ? "Не с чего считать максимальный шаг: нет снеговой нагрузки для этого " +
                "населённого пункта либо выбранной марки настила нет в таблице несущей способности."
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

      <section className="card bill-card">
        <div className="bill-head">
          <h2>Ведомость материалов</h2>
          <button type="button" className="print-button" onClick={() => window.print()}>
            Печать
          </button>
        </div>
        <p className="hint no-print">
          Те же числа, что и в карточках выше, но в порядке и структуре исходной ведомости.
          Итог каждого раздела подписан ячейкой, с которой он сверяется.
        </p>
        <div className="bill-meta">
          {climate.ok ? `${climate.value.city.settlement}, ${climate.value.city.region}` : "—"} ·{" "}
          {span} × {length} × {height} м · шаг рам {geometry.framePitch_m} м ·{" "}
          {frameTakeoff ? `${frameTakeoff.frameCount} рам` : "—"} · с/в{" "}
          {climate.ok ? climate.value.standard : "—"}
        </div>

        <table className="bill">
          <thead>
            <tr>
              <th>наименование</th>
              <th className="num">кол-во</th>
              <th>ед.</th>
              <th className="num">цена</th>
              <th className="num">стоимость</th>
              <th className="num">масса, кг</th>
            </tr>
          </thead>
          <tbody>
            {[
              { caption: "Материалы ЗАО «ИНСИ»", sections: bill.materials },
              { caption: "Дополнительные материалы", sections: bill.additional },
            ].map((block) => (
              <Fragment key={block.caption}>
                <tr className="bill-block">
                  <td colSpan={6}>{block.caption}</td>
                </tr>
                {block.sections.map((s) => (
                  <Fragment key={`${block.caption}-${s.sourceCell}`}>
                    <tr className="bill-section">
                      <td colSpan={6}>{s.title}</td>
                    </tr>
                    {s.rows.map((r, idx) => (
                      <tr key={`${s.sourceCell}-${r.name}-${idx}`}>
                        <td>
                          {r.name}
                          {r.note && <span className="incomplete"> — {r.note}</span>}
                        </td>
                        <td className="num">
                          {r.count === null
                            ? "—"
                            : r.count.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                        </td>
                        <td>{r.unit}</td>
                        <td className="num">
                          {r.unitPrice === null
                            ? "—"
                            : r.unitPrice.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="num">
                          {r.cost === null ? "—" : Math.round(r.cost).toLocaleString("ru-RU")}
                        </td>
                        <td className="num">
                          {r.mass_kg === null ? "—" : Math.round(r.mass_kg).toLocaleString("ru-RU")}
                        </td>
                      </tr>
                    ))}
                    <tr className="bill-sub">
                      <td colSpan={4}>Накладные расходы 2%</td>
                      <td className="num">
                        {s.overheadCost === null
                          ? "—"
                          : Math.round(s.overheadCost).toLocaleString("ru-RU")}
                      </td>
                      <td />
                    </tr>
                    <tr className="bill-total">
                      <td colSpan={4}>
                        Итого {s.title.toLowerCase()} <span className="cell">{s.sourceCell}</span>
                      </td>
                      <td className="num">
                        {s.totalCost === null ? "—" : Math.round(s.totalCost).toLocaleString("ru-RU")}
                      </td>
                      <td className="num">{Math.round(s.totalMass_kg).toLocaleString("ru-RU")}</td>
                    </tr>
                  </Fragment>
                ))}
              </Fragment>
            ))}
            <tr className="bill-grand">
              <td colSpan={4}>Рекомендуемая цена реализации</td>
              <td className="num">
                {bill.recommendedPrice === null
                  ? "—"
                  : Math.round(bill.recommendedPrice).toLocaleString("ru-RU")}
              </td>
              <td className="num">{Math.round(bill.buildingMass_kg).toLocaleString("ru-RU")}</td>
            </tr>
            <tr className="bill-sub">
              <td colSpan={4}>Упаковка 2%</td>
              <td className="num">
                {bill.packaging === null ? "—" : Math.round(bill.packaging).toLocaleString("ru-RU")}
              </td>
              <td />
            </tr>
            <tr className="bill-grand">
              <td colSpan={4}>ИТОГО цена + упаковка</td>
              <td className="num">
                {bill.totalWithPackaging === null
                  ? "—"
                  : Math.round(bill.totalWithPackaging).toLocaleString("ru-RU")}
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={4}>Окна, ворота, двери</td>
              <td className="num">
                {Math.round(openingsCost.totalCost).toLocaleString("ru-RU")}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
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
          <dt>Из чего складывается</dt>
          <dd>
            {(
              [
                ["обшивка", summary.shares.cladding],
                ["каркас", summary.shares.frame],
                ["прогоны", summary.shares.purlin],
                ["связи", summary.shares.bracing],
                ["крепёж", summary.shares.fasteners],
                ["профили", summary.shares.profiles],
                ["кровля", summary.shares.roofTrim],
                ["водосток", summary.shares.drainage],
              ] as [string, number | null][]
            )
              .filter(([, share]) => share !== null && share >= 0.5)
              .map(([name, share]) => `${name} ${share!.toFixed(0)}%`)
              .join(" · ")}
            {!summary.hasFullCost && (
              <span className="incomplete"> — доли от известной части</span>
            )}
          </dd>
        </dl>
        <p className="hint">
          Не учтено: затяжки, вертикальные связи фахверка, стойки фахверка (только масса),
          проектные работы и монтаж. Утеплитель, пароизоляция и ГВЛ показаны отдельной карточкой —
          в ведомости расчётчика у них нет цены, и в итог они не входят. Это предварительная
          оценка, не коммерческое предложение.
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
