import { useMemo, useState } from "react";
import { computeSvCode, getAllSettlementNames } from "./calc/climate/svCode";
import { findFrameSelection, snapHeight } from "./calc/frame/sectionBank";
import { SPANS, type ResponsibilityLevel, type Span } from "./types/common";

// Названия могут повторяться (одноимённые города в разных регионах) —
// список для <datalist> должен быть уникальным, иначе React ругается
// на дублирующиеся key и браузер схлопывает повторы в один <option>.
const settlementNames = Array.from(new Set(getAllSettlementNames()));

export function App() {
  const [city, setCity] = useState("Челябинск");
  const [span, setSpan] = useState<Span>(18);
  const [height, setHeight] = useState(5);
  const [responsibility, setResponsibility] = useState<ResponsibilityLevel>(1.0);

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

      <footer>
        <p>
          Данные подобраны по банку сечений, извлечённому из исходных Excel-калькуляторов ИНСИ.
          Ведомость материалов и стоимость — в разработке.
        </p>
      </footer>
    </div>
  );
}
