import type { TerrainType } from "./windLoad";

/** Зона обвязки стены под профлист — угловая (у торцов) или рядовая (типовая). */
export type GirtZoneKind = "corner" | "typical";

export interface GirtProfileOption {
  /** Название профиля, как в прайсе — «ПС 145х45х1,2». */
  name: string;
  family: "ПС" | "ПП" | "ТПС" | "ТПП";
  /** Типоразмер сечения, например «145х45». */
  size: string;
  thickness_mm: number;
  weightPerMeter_kg: number;
  /** null — если в прайсе для этой позиции нет цены. */
  pricePerMeter: number | null;
}

export interface GirtZoneInput {
  zoneKind: GirtZoneKind;
  /** Протяжённость зоны, м (Лист1!E24 для угловой / E29 для рядовой). */
  zoneLength_m: number;
  /** Высота расчётной стены, м (Лист1!B12). */
  wallHeight_m: number;
  /** Шаг стоек, м (Лист1!B13). */
  postStep_m: number;
  /**
   * Шаг ригелей, мм — в упрощённом режиме вводится вручную (без
   * авто-подбора по ветровому зонированию и базе профилей).
   */
  stepRigel_mm: number;
  profile: GirtProfileOption;
  /**
   * Спаренная схема сечения («[]»/«][»/«[-]» в исходном калькуляторе) —
   * влияет на число рядов (+0 вместо +1) и вес кронштейна (1,5 вместо
   * 0,75 кг). Определяется выбором профиля (одинарный/спаренный), а не
   * вводится отдельно.
   */
  paired: boolean;
}

export interface GirtZoneResult {
  input: GirtZoneInput;
  /** Число рядов ригелей по высоте (Лист1!F49/F50). */
  rows: number;
  /** Число кронштейнов (Лист1!G49/G50) — дробное для угловой зоны, формула так и не округляет. */
  brackets: number;
  bracketWeight_kg: number;
  profileLength_m: number;
  profileMass_kg: number;
}

interface WallGirtWallTypeConfigCommon {
  cornerZoneLength_m: number;
  typicalZoneLength_m: number;
  /** Высота расчётной стены, м — для торцевой стены обычно высота конька, для продольной — высота стены. */
  wallHeight_m: number;
  postStep_m: number;
}

/** Ручной ввод — менеджер сам задаёт профиль и шаг ригелей для обеих зон. */
export interface WallGirtManualConfig extends WallGirtWallTypeConfigCommon {
  mode: "manual";
  cornerStepRigel_mm: number;
  typicalStepRigel_mm: number;
  /** Название профиля из каталога (src/calc/wallGirt/catalog.ts), одинарного варианта. */
  profileName: string;
  /** Спаренная схема сечения — вес/цена профиля удваиваются (см. pairedGirtProfile). */
  paired: boolean;
}

/**
 * Автоподбор — профиль и шаг ригелей для каждой зоны считаются по
 * ветровой нагрузке и несущей способности (см. selectGirt.ts). Высота
 * здания/wo/γn приходят из остального проекта, здесь задаётся только то,
 * что специфично для обвязки: тип местности и необязательные ограничения.
 */
export interface WallGirtAutoConfig extends WallGirtWallTypeConfigCommon {
  mode: "auto";
  terrain: TerrainType;
  /** Толщина утеплителя «нашей послойки», мм; 0/не задано — фильтр не применяется. */
  insulationThickness_mm?: number;
  minStep_mm?: number;
  maxStep_mm?: number;
  minProfileHeight_mm?: number;
  maxProfileHeight_mm?: number;
}

/** Настройка обвязки для одного типа стены (торцевой или продольной). */
export type WallGirtWallTypeConfig = WallGirtManualConfig | WallGirtAutoConfig;

export interface WallGirtInputs {
  endWalls?: WallGirtWallTypeConfig;
  sideWalls?: WallGirtWallTypeConfig;
}
