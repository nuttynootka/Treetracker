export type Id = string;
/** Hybrid logical clock timestamp; see hlc.ts for the format. */
export type Hlc = string;

export interface Base {
  id: Id;
  updatedAt: Hlc;
  deleted: boolean;
  deviceId: string;
}

export interface Cut {
  startIn: number;
  endIn: number;
  lengthFt: number;
  smallCirc: number;
  rowKey: string;
}

export interface CutPlan {
  cuts: Cut[];
  leftover: { startIn: number; lengthIn: number; topCirc: number };
  wasteIn: number;
}

export interface Prediction {
  readings: number[];
  lengthFt: number;
  largeLogs: number;
}

export interface Tree extends Base {
  type: 'tree';
  createdAt: number;
  lengthFt: number;
  buttCirc: number;
  readings: number[];
  waistCirc: number;
  plan: CutPlan;
  predicted: Prediction | null;
  actualLargeLogs: number;
  warningsOverridden: boolean;
  notes: string;
}

export interface LogCut extends Base {
  type: 'log';
  source: 'tree' | 'manual';
  treeId: Id | null;
  lengthFt: number;
  smallCirc: number;
  quantity: number;
  createdAt: number;
}

export interface NeedRow extends Base {
  type: 'need';
  lengthFt: number;
  minCirc: number;
  quantity: number;
  planVersionId: Id | null;
  manuallyEdited: boolean;
}

export interface ExteriorWall {
  name: string;
  centerlineIn: number;
  hasLogs: boolean;
}

export interface WallSettings {
  postWidthIn: number;
  tenonIn: number;
  exteriorHeightIn: number;
  interiorHeightIn: number;
  toleranceBelowIn: number;
  toleranceAboveIn: number;
  /** Course height override per circumference class, keyed by circ.toFixed(1). */
  courseHeightIn: Record<string, number>;
  exteriorWalls: ExteriorWall[];
  interiorPiecesIn: number[];
}

/** Smallest circumference a side's rows require, overriding the course circumference. */
export interface RowMinimums {
  exterior?: number;
  interior?: number;
}

export interface PlanVersion extends Base {
  type: 'plan';
  version: number;
  /** Shown in the plans list. Older records have none; see planName(). */
  name?: string;
  archived?: boolean;
  rowMinimums?: RowMinimums;
  exteriorCourses: number[];
  interiorCourses: number[];
  wall: WallSettings;
  createdBy: string;
  createdAt: number;
  note: string;
}

export interface ActivePlan extends Base {
  type: 'active';
  planVersionId: Id;
  /** The plan used before this one, for "Switch back". */
  previousPlanId?: Id | null;
}

export interface SettingsValues {
  kerfIn: number;
  buttTrimIn: number;
  stumpHeightFt: number;
  waistHeightFt: number;
  maxWaistCirc: number;
  topCirc: number;
  priorTaperPerFt: number;
  shortfallMinTrees: number;
  shortfallYieldRatio: number;
  spareFraction: number;
  undoSeconds: number;
}

export interface Settings extends Base, SettingsValues {
  type: 'settings';
}

export type AnyRecord = Tree | LogCut | NeedRow | PlanVersion | ActivePlan | Settings;

export interface ProfilePoint {
  xFt: number;
  circ: number;
}

export interface Profile {
  points: ProfilePoint[];
  lengthFt: number;
}

export interface PlannerRow {
  key: string;
  lengthFt: number;
  minCirc: number;
  remaining: number;
  quantity: number;
}

export const rowKey = (lengthFt: number, minCirc: number) => `${lengthFt}|${minCirc.toFixed(1)}`;
