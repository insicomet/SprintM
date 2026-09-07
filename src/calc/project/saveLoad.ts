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

/** Версия формата: растёт, когда меняется состав исходных данных. */
export const SAVE_FORMAT_VERSION = 1;

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
  return {
    ok: true,
    value: {
      format: "sprintm-project",
      version: candidate.version,
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : "",
      title: typeof candidate.title === "string" ? candidate.title : defaultTitle(inputs),
      inputs,
    },
  };
}
