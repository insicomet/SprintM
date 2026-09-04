import { useMemo, useState } from "react";
import { computeSvCode, getAllSettlementNames } from "./calc/climate/svCode";
import { findFrameSelection, snapHeight } from "./calc/frame/sectionBank";
import { estimateSandwichPanelCladding, getSandwichPanelThicknesses } from "./calc/cladding/sandwichPanel";
import { computeRoofArea_m2, computeWallArea_m2 } from "./calc/geometry/buildingEnvelope";
import { computeFrameTakeoff } from "./calc/geometry/frameTakeoff";
import { computeRoofLoad, defaultRoofSlopeDeg } from "./calc/loads/roofLoad";
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

  const frameTakeoff = useMemo(() => {
    if (!frame?.ok || !frame.value || heightBucket === null) return null;
    return computeFrameTakeoff(
      {
        span_m: span,
        length_m: length,
        height_m: height,
        framePitch_m: frame.value.framePitch_m,
        roofSlopeDeg: defaultRoofSlopeDeg(span),
      },
      frame.value,
    );
  }, [frame, span, length, height, heightBucket]);

  const envelope = useMemo(() => {
    const geometry = {
      span_m: span,
      length_m: length,
      height_m: height,
      framePitch_m: frame?.ok && frame.value ? frame.value.framePitch_m : 6,
      roofSlopeDeg: defaultRoofSlopeDeg(span),
    };
    const wallArea = computeWallArea_m2(geometry);
    const roofArea = computeRoofArea_m2(geometry);
    return {
      wallArea,
      roofArea,
      wall: estimateSandwichPanelCladding(wallArea, claddingThickness, "wall", "zLock"),
      roof: estimateSandwichPanelCladding(roofArea, claddingThickness, "roof"),
    };
  }, [span, length, height, frame, claddingThickness]);

  const purlin = useMemo(() => {
    if (!roofLoad) return undefined;
    return selectPurlin({
      roofLoad_kPa: roofLoad.total_kPa,
      framePitch_m: frame?.ok && frame.value ? frame.value.framePitch_m : 6,
      minStep_mm: 500,
      maxStep_mm: maxStepMm,
    });
  }, [roofLoad, frame, maxStepMm]);

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
              <dt>Итого металл каркаса</dt>
              <dd>
                {frameTakeoff.totalFrameMass_kg !== null
                  ? `${frameTakeoff.totalFrameMass_kg.toFixed(0)} кг`
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
          </dl>
        ) : (
          <p className="error">
            Ни один профиль в каталоге не держит эту нагрузку при минимальном шаге 500мм.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Обшивка (сэндвич-панели)</h2>
        <p className="hint">Площади без вычета ворот/дверей/окон — они считаются отдельно.</p>
        <dl className="result-list">
          <dt>Стены</dt>
          <dd>
            {envelope.wallArea.toFixed(1)} м²
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

      <footer>
        <p>
          Данные подобраны по банку сечений, извлечённому из исходных Excel-калькуляторов ИНСИ.
          Ведомость материалов и стоимость — в разработке.
        </p>
      </footer>
    </div>
  );
}
