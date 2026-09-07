import type { Span } from "../../types/common";

/** Одна строка таблицы «Подобранные сечения» подборщика. */
export interface SecondaryMember {
  /** Название строки, как в подборщике (лист «вывод», столбец C). */
  name: string;
  /** Сечение; null — если правило нам неизвестно (см. facadePost при пролёте >21). */
  section: string | null;
  /** Марка стали (столбец E). */
  steel: string;
  /** Почему сечения нет, если его нет. */
  missing?: string;
}

export interface SecondaryMembersInput {
  span_m: Span;
  length_m: number;
  height_m: number;
  framePitch_m: number;
  /** Снеговой район из лестницы нагрузок — «I»…«V». */
  snowDistrict: string;
  /** «Спринт с СГ по Р» (вывод!D29 = «+») — только для пролёта 24 м. */
  trussedVariant?: boolean;
}

export interface SecondaryMembers {
  /** Строки, которые подборщик выводит формулой. */
  derived: SecondaryMember[];
  /** Строки, которые в подборщике вписаны константой и от габаритов не зависят. */
  fixed: SecondaryMember[];
}

/**
 * Второстепенные сечения рамы — затяжки, подвески, распорки, связи,
 * стойки фахверка и пластины узлов.
 *
 * Всё это подборщик выводит формулами (лист «вывод», строки 36–41),
 * а мы раньше либо держали константой внутри расчёта масс, либо
 * спрашивали у пользователя. Формулы источника:
 *
 *   Затяжки, Подвески = ЕСЛИ(пролёт<21; 63х5;
 *                         ЕСЛИ(район="I"; 63х5; ЕСЛИ(район="II"; 63х5; 75х5)))
 *   Распорки          = ЕСЛИ(СГ_по_Р; 100х3; ЕСЛИ(шаг<=4; 60х3; 80х3))
 *   Связи гориз.      = ЕСЛИ(СГ_по_Р; 120х4;
 *                         ЕСЛИ(пролёт>21; ЕСЛИ(шаг<=4; 100х3; 120х3); 80х3))
 *   Связи верт.       = ЕСЛИ(СГ_по_Р; 120х4;
 *                         ЕСЛИ(ДЛИНА>21; 80х3; ЕСЛИ(шаг<=4; 100х3; 120х3)))
 *   Стойки фахверка   = ЕСЛИ(пролёт>21; <подбор на листе 24м>;
 *                         ЕСЛИ(высота<3; кв. 120х4; кв. 160х4))
 *   Сталь связей и распорок = ЕСЛИ(пролёт>21; С345; С245)
 *
 * Сверено на шести проектах — двух реальных и четырёх выдуманных
 * (см. secondaryMembers.test.ts).
 *
 * ДВЕ ОСОБЕННОСТИ ИСТОЧНИКА, воспроизведённые как есть:
 *
 * 1. У вертикальных связей в условии стоит ДЛИНА здания (D5), а у
 *    горизонтальных — пролёт (D4). Похоже на описку в файле: в остальном
 *    формулы близнецы. На всех шести проектах длина больше 21 м, поэтому
 *    разницы не видно — вопрос расчётчику.
 * 2. Ведомость этих сечений не знает: в её формуле массы связей жёстко
 *    сидит труба 80х3, а в «Уголке» — 63х5. На пролётах до 21 м это ровно
 *    то же самое, что даёт правило, а на 24 м расходится (подборщик просит
 *    100х3). Массу пока считаем по ведомости — см. bracing.ts.
 */
export function selectSecondaryMembers(input: SecondaryMembersInput): SecondaryMembers {
  const { span_m, length_m, height_m, framePitch_m, snowDistrict } = input;
  const trussed = input.trussedVariant === true;
  const braceSteel = span_m > 21 ? "С345" : "С245";

  const lightSnow = snowDistrict === "I" || snowDistrict === "II";
  const tie = span_m < 21 || lightSnow ? "┘└2уг. 63х5" : "┘└2уг. 75х5";

  const strut = trussed ? "100х3" : framePitch_m <= 4 ? "60х3" : "80х3";
  const horizBrace = trussed ? "120х4" : span_m > 21 ? (framePitch_m <= 4 ? "100х3" : "120х3") : "80х3";
  // Да, здесь именно длина здания, а не пролёт — так в источнике.
  const vertBrace = trussed ? "120х4" : length_m > 21 ? "80х3" : framePitch_m <= 4 ? "100х3" : "120х3";

  const facadePost: SecondaryMember =
    span_m > 21
      ? {
          name: "Стойки фахверка",
          section: null,
          steel: braceSteel,
          missing: "считает подборщик на листе «24м»",
        }
      : {
          name: "Стойки фахверка",
          section: height_m < 3 ? "кв. 120х4" : "кв. 160х4",
          steel: braceSteel,
        };

  return {
    derived: [
      { name: "Затяжки", section: tie, steel: "С345" },
      { name: "Подвески", section: tie, steel: "С345" },
      { name: "Распорки", section: strut, steel: braceSteel },
      { name: "Связи горизонтальные", section: horizBrace, steel: braceSteel },
      { name: "Связи вертикальные", section: vertBrace, steel: braceSteel },
      facadePost,
    ],
    fixed: [
      { name: "Пластина карниз, конек", section: "t5", steel: "С255" },
      { name: "Пластина опора", section: "t6", steel: "С255" },
    ],
  };
}
