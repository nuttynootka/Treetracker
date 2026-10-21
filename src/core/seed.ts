import { SEED_HLC } from './hlc';
import { generateRows } from './wall';
import { rowKey } from './types';
import type { ActivePlan, AnyRecord, Id, NeedRow, PlanVersion, Settings, SettingsValues, WallSettings } from './types';

export const DEFAULT_SETTINGS: SettingsValues = {
  kerfIn: 0.375,
  buttTrimIn: 2,
  stumpHeightFt: 1,
  waistHeightFt: 4,
  maxWaistCirc: 37.7,
  topCirc: 12.6,
  priorTaperPerFt: 0.59,
  shortfallMinTrees: 3,
  shortfallYieldRatio: 0.6,
  spareFraction: 0.1,
  undoSeconds: 10,
};

export const DEFAULT_WALL: WallSettings = {
  postWidthIn: 13,
  tenonIn: 3,
  exteriorHeightIn: 84,
  interiorHeightIn: 84,
  toleranceBelowIn: 2,
  toleranceAboveIn: 4.5,
  courseHeightIn: {},
  exteriorWalls: [
    { name: 'W1', centerlineIn: 120, hasLogs: true },
    { name: 'W2', centerlineIn: 96, hasLogs: false },
    { name: 'W3', centerlineIn: 192, hasLogs: true },
    { name: 'W4', centerlineIn: 144, hasLogs: true },
    { name: 'W5', centerlineIn: 192, hasLogs: true },
    { name: 'W6', centerlineIn: 96, hasLogs: true },
    { name: 'W7', centerlineIn: 120, hasLogs: true },
    { name: 'W8', centerlineIn: 120, hasLogs: true },
  ],
  interiorPiecesIn: [48, 48, 60, 62],
};

const rep = (c: number, n: number) => Array<number>(n).fill(c);

export const PLAN_V1_COURSES = {
  exterior: [...rep(28.3, 4), ...rep(25.2, 6)],
  interior: [...rep(18.9, 4), ...rep(15.8, 8), ...rep(12.6, 5)],
};

export const needRowId = (planId: Id, lengthFt: number, minCirc: number): Id => `${planId}:${rowKey(lengthFt, minCirc)}`;

const seedBase = { updatedAt: SEED_HLC, deleted: false, deviceId: 'seed' };

export function seedRecords(): AnyRecord[] {
  const settings: Settings = { id: 'settings', type: 'settings', ...seedBase, ...DEFAULT_SETTINGS };
  const plan: PlanVersion = {
    id: 'plan-v1',
    type: 'plan',
    ...seedBase,
    version: 1,
    name: 'Starting plan',
    exteriorCourses: [...PLAN_V1_COURSES.exterior],
    interiorCourses: [...PLAN_V1_COURSES.interior],
    wall: structuredClone(DEFAULT_WALL),
    createdBy: 'seed',
    createdAt: 0,
    note: 'Starting plan',
  };
  const rows: NeedRow[] = generateRows(plan.exteriorCourses, plan.interiorCourses, plan.wall).map((r) => ({
    id: needRowId(plan.id, r.lengthFt, r.minCirc),
    type: 'need',
    ...seedBase,
    ...r,
    planVersionId: plan.id,
    manuallyEdited: false,
  }));
  const active: ActivePlan = { id: 'active-plan', type: 'active', ...seedBase, planVersionId: plan.id };
  return [settings, plan, ...rows, active];
}
