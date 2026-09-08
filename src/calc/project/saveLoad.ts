import type { OpeningGroup, OpeningsInput } from "../geometry/openings";
import type { ProjectInputs } from "./computeProject";

/**
 * Сохранение и открытие расчёта.
 *
 * Расчёт целиком определяется исходными данными: всё остальное —
 * следствие. Поэтому в файл кладём именно их, а не результат, и при
 * открытии он пересчитывается заново на текущих правилах. Это важно,
 * пока правила ещё уточняются: старый файл, открытый завтра, даст
 * сегодняшний ответ, а не законсервированный.
 */

/**
 * Версия формата: растёт, когда меняется состав исходных данных.
 *
 * 2 — проёмы стали списком размеров на тип (вопрос 02), а не одним
 * числом. Файлы версии 1 при открытии превращаются в списки из одного
 * элемента — старый файл открывается как раньше, просто с одним слотом.
 */
export const SAVE_FORMAT_VERSION = 2;

/** Старая форма поля «Проёмы» (версия формата 1) — один размер на тип. */
interface OpeningsInputV1 {
  gatesCount: number;
  gateWidth_m: number;
  gateHeight_m: number;
  doorsCount: number;
  doorWidth_m: number;
  doorHeight_m: number;
  windowsCount: number;
  windowWidth_m: number;
  windowHeight_m: number;
}

function isOpeningsV1(openings: unknown): openings is OpeningsInputV1 {
  return typeof openings === "object" && openings !== null && "gatesCount" in openings;
}

function toGroup(count: number, width_m: number, height_m: number): OpeningGroup[] {
  return count > 0 || width_m > 0 || height_m > 0 ? [{ count, width_m, height_m }] : [];
}

/** Один слот на тип — так выглядел любой файл до версии 2. */
function migrateOpeningsV1(v1: OpeningsInputV1): OpeningsInput {
  return {
    gates: toGroup(v1.gatesCount, v1.gateWidth_m, v1.gateHeight_m),
    doors: toGroup(v1.doorsCount, v1.doorWidth_m, v1.doorHeight_m),
    windows: toGroup(v1.windowsCount, v1.windowWidth_m, v1.windowHeight_m),
  };
}

/** Привести исходные данные из файла к текущей форме — старые версии сюда и мигрируют. */
function migrateInputs(inputs: ProjectInputs): ProjectInputs {
  const openings = (inputs as { openings?: unknown }).openings;
  if (isOpeningsV1(openings)) {
    return { ...inputs, openings: migrateOpeningsV1(openings) };
  }
  return inputs;
}

export interface SavedProject {
  format: "sprintm-project";
  version: number;
  /** Когда сохранён — для списка последних расчётов. */
  savedAt: string;
  /** Как назвать файл и строку в списке. */
  title: string;
  inputs: ProjectInputs;
}

export function serializeProject(inputs: ProjectInputs, title?: string): SavedProject {
  return {
    format: "sprintm-project",
    version: SAVE_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    title: (title ?? "").trim() || defaultTitle(inputs),
    // Копия, а не ссылка: форма живёт дальше и не должна задним числом
    // менять уже сохранённое.
    inputs: structuredClone(inputs),
  };
}

/** «Челябинск 18×30×5» — понятно в списке без открывания. */
export function defaultTitle(inputs: ProjectInputs): string {
  const city = inputs.city?.split(",")[0]?.trim() || "Без города";
  return `${city} ${inputs.span}×${inputs.length_m}×${inputs.height_m}`;
}

/** Имя файла: без слэшей и прочего, что ломает загрузку. */
export function fileNameFor(saved: SavedProject): string {
  const safe = saved.title.replace(/[^\wа-яёА-ЯЁ\d×.\- ]/gi, "").trim() || "расчёт";
  return `${safe}.sprintm.json`;
}

export type LoadResult =
  | { ok: true; value: SavedProject }
  | { ok: false; error: string };

/**
 * Разбор сохранённого файла.
 *
 * Проверяем ровно то, без чего расчёт не поедет: что это наш формат, что
 * версия не из будущего и что на месте обязательные габариты. Остальное
 * пусть подставляется значениями по умолчанию — файл мог быть сохранён
 * до того, как поле появилось.
 */
export function parseSavedProject(text: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Это не файл расчёта: не читается как JSON" };
  }
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Это не файл расчёта" };
  }
  const candidate = raw as Partial<SavedProject>;
  if (candidate.format !== "sprintm-project") {
    return { ok: false, error: "Это не файл расчёта СпринтМ" };
  }
  if (typeof candidate.version !== "number" || candidate.version > SAVE_FORMAT_VERSION) {
    return {
      ok: false,
      error: `Файл сохранён более новой версией приложения (формат ${candidate.version})`,
    };
  }
  const inputs = candidate.inputs as ProjectInputs | undefined;
  if (!inputs || typeof inputs !== "object") {
    return { ok: false, error: "В файле нет исходных данных" };
  }
  for (const key of ["span", "length_m", "height_m"] as const) {
    if (typeof inputs[key] !== "number" || !Number.isFinite(inputs[key])) {
      return { ok: false, error: `В файле не хватает поля «${key}»` };
    }
  }
  const migrated = migrateInputs(inputs);
  return {
    ok: true,
    value: {
      format: "sprintm-project",
      version: candidate.version,
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : "",
      title: typeof candidate.title === "string" ? candidate.title : defaultTitle(migrated),
      inputs: migrated,
    },
  };
}
