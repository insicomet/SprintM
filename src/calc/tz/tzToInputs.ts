import type { OpeningsInput } from "../geometry/openings";
import type { ParsedTz, TzOpening } from "./parseTz";

/**
 * Перевод разобранного ТЗ в исходные данные расчёта.
 *
 * Раньше здесь ещё сводились несколько размеров одного типа проёма в
 * один — приложение держало по одному размеру на тип. Расчётчик
 * подтвердила (вопрос 02), что сама она в таком случае просто заводит
 * ещё один слот, поэтому сведение убрано: каждый размер из ТЗ становится
 * своим отдельным слотом, как у неё.
 */

export interface TzFill {
  city?: string;
  span?: number;
  length_m?: number;
  height_m?: number;
  gammaN?: number;
  wallPanel_mm?: number;
  roofPanel_mm?: number;
  openings: OpeningsInput;
  snowGuards?: boolean;
  /** Тот же пункт 14 ТЗ, что и snowGuards — см. ParsedTz.drainageAndSnowGuards. */
  hasDrainage?: boolean;
  railingPurlin?: boolean;
  /** Что пришлось развернуть — показываем менеджеру. */
  adjustments: string[];
}

/**
 * Окно в ТЗ пишут «1х6м», и это не метр в ширину и шесть в высоту:
 * шестиметрового окна в четырёхметровом здании не бывает. Окна здесь
 * ленточные, поэтому меньшее из двух чисел — высота. У дверей и ворот
 * порядок прямой: «1х2,1м» — метр в ширину, 2,1 в высоту.
 */
function asBandWindow(o: TzOpening): TzOpening {
  const width_m = Math.max(o.width_m, o.height_m);
  const height_m = Math.min(o.width_m, o.height_m);
  return { width_m, height_m, count: o.count };
}

export function tzToInputs(tz: ParsedTz): TzFill {
  const adjustments: string[] = [];
  const windows = tz.windows.map(asBandWindow);
  if (tz.windows.some((o, i) => o.width_m !== windows[i].width_m)) {
    adjustments.push("Окна развёрнуты в ленточные: меньшая сторона принята за высоту");
  }

  return {
    city: tz.city,
    span: tz.span,
    length_m: tz.length_m,
    height_m: tz.height_m,
    gammaN: tz.gammaN,
    wallPanel_mm: tz.wallInsulation_mm,
    roofPanel_mm: tz.roofInsulation_mm,
    snowGuards: tz.drainageAndSnowGuards,
    hasDrainage: tz.drainageAndSnowGuards,
    railingPurlin: tz.drainageAndSnowGuards,
    openings: {
      gates: tz.gates.map((o) => ({ ...o })),
      doors: tz.doors.map((o) => ({ ...o })),
      windows: windows.map((o) => ({ ...o })),
    },
    adjustments,
  };
}
