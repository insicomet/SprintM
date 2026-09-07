import type { OpeningsInput } from "../geometry/openings";
import type { ParsedTz, TzOpening } from "./parseTz";

/**
 * Перевод разобранного ТЗ в исходные данные расчёта.
 *
 * Две вещи здесь делаются не «как написано», и обе объясняются ниже:
 * ориентация окон и сведение нескольких размеров в один.
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
  /** Что пришлось свести или повернуть — показываем менеджеру. */
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

function totalArea(list: TzOpening[]): number {
  return list.reduce((s, o) => s + o.width_m * o.height_m * o.count, 0);
}

function totalCount(list: TzOpening[]): number {
  return list.reduce((s, o) => s + o.count, 0);
}

/**
 * Свести несколько размеров одного типа в один.
 *
 * Приложение (как и блок «Проемы» ведомости) держит по одному размеру на
 * тип, а в ТЗ их бывает три. Сводим так, чтобы сохранились ЧИСЛО проёмов
 * и их СУММАРНАЯ ПЛОЩАДЬ: высоту берём самую частую, ширину подбираем
 * под площадь. Площадь и число — это всё, что уходит в стоимость проёмов
 * и в вычет из стены.
 *
 * Точным это сведение быть не может: вычет из стены считается по
 * округлённым вниз размерам каждого проёма, и на дробных ширинах сумма
 * может разойтись. Поэтому расхождение проверяется и, если оно есть,
 * попадает в `adjustments` — менеджер увидит, а не узнает потом.
 */
function mergeOpenings(list: TzOpening[], label: string, adjustments: string[]):
  { width_m: number; height_m: number; count: number } {
  if (list.length === 0) return { width_m: 0, height_m: 0, count: 0 };
  if (list.length === 1) return { ...list[0] };

  const count = totalCount(list);
  const area = totalArea(list);
  // Самая частая высота; при равенстве — наибольшая.
  const byHeight = new Map<number, number>();
  for (const o of list) byHeight.set(o.height_m, (byHeight.get(o.height_m) ?? 0) + o.count);
  const height_m = [...byHeight.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const width_m = area / count / height_m;

  const sizes = list.map((o) => `${o.count}×${o.width_m}×${o.height_m}`).join(", ");
  adjustments.push(
    `${label}: ${sizes} сведены к ${count} × ${round(width_m)} × ${height_m} м ` +
      `(площадь ${round(area)} м² сохранена)`,
  );

  const floored = list.reduce(
    (s, o) => s + Math.floor(o.width_m) * Math.floor(o.height_m) * o.count,
    0,
  );
  const mergedFloored = Math.floor(width_m) * Math.floor(height_m) * count;
  if (Math.abs(floored - mergedFloored) > 1e-9) {
    adjustments.push(
      `${label}: вычет из стены после сведения ${mergedFloored} м² вместо ${floored} м² — ` +
        `проверьте размеры вручную`,
    );
  }
  return { width_m, height_m, count };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export function tzToInputs(tz: ParsedTz): TzFill {
  const adjustments: string[] = [];
  const windows = tz.windows.map(asBandWindow);
  if (tz.windows.some((o, i) => o.width_m !== windows[i].width_m)) {
    adjustments.push("Окна развёрнуты в ленточные: меньшая сторона принята за высоту");
  }

  const gates = mergeOpenings(tz.gates, "Ворота", adjustments);
  const doors = mergeOpenings(tz.doors, "Двери", adjustments);
  const win = mergeOpenings(windows, "Окна", adjustments);

  return {
    city: tz.city,
    span: tz.span,
    length_m: tz.length_m,
    height_m: tz.height_m,
    gammaN: tz.gammaN,
    wallPanel_mm: tz.wallInsulation_mm,
    roofPanel_mm: tz.roofInsulation_mm,
    snowGuards: tz.drainageAndSnowGuards,
    openings: {
      gatesCount: gates.count, gateWidth_m: gates.width_m, gateHeight_m: gates.height_m,
      doorsCount: doors.count, doorWidth_m: doors.width_m, doorHeight_m: doors.height_m,
      windowsCount: win.count, windowWidth_m: win.width_m, windowHeight_m: win.height_m,
    },
    adjustments,
  };
}
