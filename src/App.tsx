import { useMemo, useState } from "react";
import { computeSvCode, getAllSettlementNames } from "./calc/climate/svCode";
import { findFrameSelection, snapHeight } from "./calc/frame/sectionBank";
import { estimateSandwichPanelCladding, getSandwichPanelThicknesses } from "./calc/cladding/sandwichPanel";
import { facadePostCount } from "./calc/facadePost/postCount";
import { selectFacadePost } from "./calc/facadePost/selectFacadePost";
import { computeRoofArea_m2, computeWallArea_m2 } from "./calc/geometry/buildingEnvelope";
import { computeFrameFasteners } from "./calc/geometry/frameFasteners";
import { rafterLengthPerFrame_m } from "./calc/geometry/frameGeometry";
import { computeFrameTakeoff } from "./calc/geometry/frameTakeoff";
import { computeOpeningsArea_m2, DEFAULT_OPENINGS, type OpeningsInput } from "./calc/geometry/openings";
import { computeRoofLoad, defaultRoofSlopeDeg } from "./calc/loads/roofLoad";
import { computePurlinLayout } from "./calc/purlin/purlinLayout";
import { selectPurlin } from "./calc/purlin/selectPurlin";
import roofingTypesRaw from "./data/roofingSelfWeight.json";
import { SPANS, type ResponsibilityLevel, type Span } from "./types/common";

// Названия могут повторяться (одноимённые города в разных регионах) —
// список для <datalist> должен быть уникальным, иначе React ругается
// на дублирующиеся key и браузер схлопывает повторы в один <option>.
const settlementNames = Array.from(new Set(getAllSettlementNames()));

const roofingTypes = roofingTypesRaw as { type: string; selfWeight_kg_m2: number }[];

export function App() {
  const [city, setCity] = useState("Челябинск");
  const [span, setSpan] = useState<Span>(18);
  const [length, setLength] = useState(30);
  const [height, setHeight] = useState(5);
  const [responsibility, setResponsibility] = useState<ResponsibilityLevel>(1.0);
  const [roofingType, setRoofingType] = useState(
    roofingTypes.find((r) => r.type === "С-П 150")!.type,
  );
  const [maxStepMm, setMaxStepMm] = useState(1500);
  const [claddingThickness, setCladdingThickness] = useState(100);
  const [openings, setOpenings] = useState<OpeningsInput>(DEFAULT_OPENINGS);
  const [postSpacing, setPostSpacing] = useState(2);

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
    if (!frameTakeoff) return null;
    return computeFrameFasteners(geometry, frameTakeoff.frameCount);
  }, [frameTakeoff, geometry]);

  const openingsArea = useMemo(() => computeOpeningsArea_m2(openings), [openings]);

  const envelope = useMemo(() => {
    const grossWallArea = computeWallArea_m2(geometry);
    const wallArea = Math.max(0, grossWallArea - openingsArea);
    const roofArea = computeRoofArea_m2(geometry);
    return {
      grossWallArea,
      wallArea,
      roofArea,
      wall: estimateSandwichPanelCladding(wallArea, claddingThickness, "wall", "zLock"),
      roof: estimateSandwichPanelCladding(roofArea, claddingThickness, "roof"),
    };
  }, [geometry, openingsArea, claddingThickness]);

  const purlin = useMemo(() => {
    if (!roofLoad) return undefined;
    return selectPurlin({
      roofLoad_kPa: roofLoad.total_kPa,
      framePitch_m: geometry.framePitch_m,
      minStep_mm: 500,
      maxStep_mm: maxStepMm,
    });
  }, [roofLoad, geometry, maxStepMm]);

  const purlinLayout = useMemo(() => {
    if (!purlin) return null;
    return computePurlinLayout(purlin, rafterLengthPerFrame_m(geometry), geometry.length_m);
  }, [purlin, geometry]);

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

  const summary = useMemo(() => {
    const steelMass_kg =
      (frameTakeoff?.totalFrameMass_kg ?? 0) +
      (frameTakeoff?.gussetPlatesMass_kg ?? 0) +
      (frameFasteners?.totalMass_kg ?? 0) +
      (purlinLayout?.totalMass_kg ?? 0) +
      (facadePostLayout?.totalMass_kg ?? 0);
    const hasFullSteelMass =
      frameTakeoff?.totalFrameMass_kg !== null &&
      frameTakeoff?.gussetPlatesMass_kg !== null &&
      frameFasteners !== null &&
      purlinLayout?.totalMass_kg !== null &&
      facadePostLayout?.totalMass_kg !== null;

    const claddingCost =
      envelope.wall?.cost != null && envelope.roof?.cost != null
        ? envelope.wall.cost + envelope.roof.cost
        : null;

    const knownCost =
      (frameTakeoff?.totalFrameCost ?? 0) + (claddingCost ?? 0) + (purlinLayout?.totalCost ?? 0);
    const hasFullCost =
      frameTakeoff?.totalFrameCost != null && claddingCost != null && purlinLayout?.totalCost != null;

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
    };

    return { steelMass_kg, hasFullSteelMass, claddingCost, knownCost, hasFullCost, shares };
  }, [frameTakeoff, frameFasteners, purlinLayout, facadePostLayout, envelope]);

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
            Макс. шаг прогонов, мм
            <input
              type="number"
              step="50"
              min="500"
              value={maxStepMm}
              onChange={(e) => setMaxStepMm(Number(e.target.value))}
            />
          </label>

          <label>
            Толщина сэндвич-панели, мм
            <select
              value={claddingThickness}
              onChange={(e) => setCladdingThickness(Number(e.target.value))}
            >
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
            Шаг стоек фахверка, м
            <input
              type="number"
              min="0.5"
              step="0.1"
              value={postSpacing}
              onChange={(e) => setPostSpacing(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Климат</h2>
        {climate.ok ? (
          <dl className="result-list">
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
              <dt>Узловые пластины</dt>
              <dd>
                {frameTakeoff.gussetPlatesMass_kg !== null
                  ? `${frameTakeoff.gussetPlatesMass_kg.toFixed(0)} кг (оценка ИНСИ, состав не расшифрован)`
                  : "нет данных для этой комбинации"}
              </dd>
              {frameFasteners && (
                <>
                  <dt>Крепёж Фс11/Фс14</dt>
                  <dd>
                    {Math.round(frameFasteners.fc11_14Count)} шт — {frameFasteners.fc11_14Mass_kg.toFixed(0)} кг
                    (цена неизвестна)
                  </dd>
                  <dt>Крепёж Фс12</dt>
                  <dd>
                    {Math.round(frameFasteners.fc12Count)} шт — {frameFasteners.fc12Mass_kg.toFixed(0)} кг (цена
                    неизвестна)
                  </dd>
                  <dt>Саморез 5,5x25</dt>
                  <dd>
                    {Math.round(frameFasteners.screw525Count)} шт — {frameFasteners.screw525Mass_kg.toFixed(1)} кг
                    (цена неизвестна){frameFasteners.screw525RateIsEstimated ? ", ставка оценочная" : ""}
                  </dd>
                  <dt>Болт М16х50</dt>
                  <dd>
                    {Math.round(frameFasteners.boltM16Count)} шт — {frameFasteners.boltM16Mass_kg.toFixed(0)} кг
                    (цена неизвестна){frameFasteners.boltM16RateIsEstimated ? ", ставка оценочная" : ""}
                  </dd>
                </>
              )}
              <dt>Итого металл каркаса</dt>
              <dd>
                {frameTakeoff.totalFrameMass_kg !== null
                  ? `${(
                      frameTakeoff.totalFrameMass_kg +
                      (frameTakeoff.gussetPlatesMass_kg ?? 0) +
                      (frameFasteners?.totalMass_kg ?? 0)
                    ).toFixed(0)} кг`
                  : "—"}
              </dd>
            </dl>
          </>
        ) : (
          <p className="error">Нет данных для расчёта ведомости.</p>
        )}
      </section>

      <section className="card">
        <h2>Прогоны — независимый расчёт</h2>
        <p className="hint">
          Считается по каталогу сечений напрямую (нагрузка → несущая способность), а не берётся из
          банка сечений — для сверки с колонкой «Прогоны» выше.
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
            <dt>Профиль</dt>
            <dd>
              {purlin.profile.name} ({purlin.profile.series})
            </dd>
            <dt>Принятый шаг</dt>
            <dd>{purlin.step_mm.toFixed(0)} мм</dd>
            <dt>Расход стали</dt>
            <dd>{purlin.massPerRoofArea_kg_m2.toFixed(2)} кг/м² кровли</dd>
            {purlinLayout && (
              <>
                <dt>Линий прогонов</dt>
                <dd>{purlinLayout.lineCount} шт.</dd>
                <dt>Суммарно на здание</dt>
                <dd>
                  {purlinLayout.totalLength_m.toFixed(0)} м
                  {purlinLayout.totalMass_kg !== null
                    ? ` — ${purlinLayout.totalMass_kg.toFixed(0)} кг`
                    : ""}
                  {purlinLayout.totalCost !== null
                    ? ` — ${purlinLayout.totalCost.toLocaleString("ru-RU")} ₽`
                    : " — цена неизвестна"}
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="error">
            Ни один профиль в каталоге не держит эту нагрузку при минимальном шаге 500мм.
          </p>
        )}
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
          Стены — за вычетом площади ворот/дверей ({openingsArea.toFixed(1)} м²); окна считаются
          суммарной площадью, без раскладки по фасадам.
        </p>
        <dl className="result-list">
          <dt>Стены (нетто)</dt>
          <dd>
            {envelope.wallArea.toFixed(1)} м² из {envelope.grossWallArea.toFixed(1)} м²
            {envelope.wall?.cost !== null && envelope.wall?.cost !== undefined
              ? ` — ${envelope.wall.cost.toLocaleString("ru-RU")} ₽`
              : " — цена неизвестна для этой толщины/крепления"}
          </dd>
          <dt>Кровля</dt>
          <dd>
            {envelope.roofArea.toFixed(1)} м²
            {envelope.roof?.cost !== null && envelope.roof?.cost !== undefined
              ? ` — ${envelope.roof.cost.toLocaleString("ru-RU")} ₽`
              : " — цена неизвестна для этой толщины"}
          </dd>
          <dt>Итого обшивка</dt>
          <dd>
            {envelope.wall?.cost != null && envelope.roof?.cost != null
              ? `${(envelope.wall.cost + envelope.roof.cost).toLocaleString("ru-RU")} ₽`
              : "—"}
          </dd>
        </dl>
      </section>

      <section className="card summary-card">
        <h2>Итоговая сводка</h2>
        <dl className="result-list">
          <dt>Металл (каркас + пластины + прогоны + стойки)</dt>
          <dd>
            {summary.steelMass_kg.toFixed(0)} кг
            {!summary.hasFullSteelMass && " (частично — см. предупреждения выше)"}
          </dd>
          <dt>Обшивка</dt>
          <dd>
            {summary.claddingCost !== null
              ? `${summary.claddingCost.toLocaleString("ru-RU")} ₽`
              : "цена неизвестна"}
            {summary.shares.cladding !== null && ` (${summary.shares.cladding.toFixed(0)}% — не зависит от климата)`}
          </dd>
          <dt>Каркас (металл)</dt>
          <dd>
            {frameTakeoff?.totalFrameCost != null
              ? `${frameTakeoff.totalFrameCost.toLocaleString("ru-RU")} ₽`
              : "цена неизвестна"}
            {summary.shares.frame !== null && ` (${summary.shares.frame.toFixed(0)}% — зависит от климата)`}
          </dd>
          <dt>Прогоны</dt>
          <dd>
            {purlinLayout?.totalCost != null
              ? `${purlinLayout.totalCost.toLocaleString("ru-RU")} ₽`
              : "цена неизвестна"}
            {summary.shares.purlin !== null && ` (${summary.shares.purlin.toFixed(0)}% — зависит от климата)`}
          </dd>
          <dt>Известная стоимость материалов</dt>
          <dd className="summary-total">
            {summary.knownCost.toLocaleString("ru-RU")} ₽
            {!summary.hasFullCost && " (не полная — часть позиций ещё не оценена)"}
          </dd>
        </dl>
        <p className="hint">
          Не учтено: связи, затяжки, прочий крепёж (кроме Фс11/12/14, саморезов 5,5x25 и болтов
          М16х50), доборные элементы, водосток, цена узловых пластин и всего крепежа (только масса)
          и стоек фахверка (только масса), монтаж. Это предварительная оценка металла и обшивки, не
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
