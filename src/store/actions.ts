import { Clock } from '../core/hlc';
import { planTree } from '../core/planner';
import { buildProfile, circAt, readingStations, waistCirc } from '../core/profile';
import { predictProfile } from '../core/predict';
import { largestClassCount } from '../core/recommend';
import { needRowId } from '../core/seed';
import { generateRows } from '../core/wall';
import { round1 } from '../core/num';
import type { CandidatePlan } from '../core/recalc';
import { samePlan } from '../core/planfile';
import type { AnyRecord, Id, LogCut, NeedRow, PlanVersion, RowMinimums, SettingsValues, Tree, WallSettings, ActivePlan, Settings } from '../core/types';

type PlanFields = Pick<PlanVersion, 'exteriorCourses' | 'interiorCourses' | 'note'> & { wall?: WallSettings; rowMinimums?: RowMinimums };
import { deriveState } from './derive';

export interface TreeInput {
  lengthFt: number;
  buttCirc: number;
  readings: number[];
  warningsOverridden: boolean;
  notes?: string;
}

/** Every change the app can make. Each returns the records to save, stamped with this device and a new clock value. */
export function createActions(clock: Clock, device: { id: string }, now: () => number) {
  const stamp = <T extends AnyRecord>(r: T): T => ({ ...r, updatedAt: clock.tick(), deviceId: device.id });
  const tomb = <T extends AnyRecord>(r: T): T => stamp({ ...r, deleted: true });

  function treeWaist(t: Pick<Tree, 'lengthFt' | 'buttCirc' | 'readings'>, s: SettingsValues) {
    return waistCirc(buildProfile(t.lengthFt, t.buttCirc, t.readings, s.topCirc), s);
  }

  function rowsFor(plan: PlanVersion, records: AnyRecord[]): NeedRow[] {
    const existing = new Map(records.map((r) => [r.id, r]));
    return generateRows(plan.exteriorCourses, plan.interiorCourses, plan.wall, plan.rowMinimums).map((g) => {
      const id = needRowId(plan.id, g.lengthFt, g.minCirc);
      const prev = existing.get(id) as NeedRow | undefined;
      return stamp({ ...(prev ?? {}), id, type: 'need', deleted: false, ...g, planVersionId: plan.id, manuallyEdited: false } as NeedRow);
    });
  }

  function activate(target: PlanVersion, records: AnyRecord[]): AnyRecord[] {
    const d = deriveState(records);
    if (d.plan.id === target.id) {
      // Already in use: only rebuild its rows if they are missing.
      const hasRows = records.some((r) => r.type === 'need' && !r.deleted && r.planVersionId === target.id);
      return hasRows ? [] : rowsFor(target, records);
    }
    const oldRows = records.filter((r): r is NeedRow => r.type === 'need' && !r.deleted && r.planVersionId === d.plan.id);
    const active = records.find((r): r is ActivePlan => r.type === 'active')!;
    const unarchived = target.archived ? [stamp({ ...target, archived: false })] : [];
    return [...oldRows.map(tomb), ...rowsFor(target, records), ...unarchived, stamp({ ...active, planVersionId: target.id, previousPlanId: d.plan.id })];
  }

  /** A new plan record, not yet in use. */
  function makePlan(fields: PlanFields, name: string | undefined, records: AnyRecord[]): PlanVersion {
    const cur = deriveState(records).plan;
    const version = Math.max(...records.filter((r): r is PlanVersion => r.type === 'plan').map((p) => p.version)) + 1;
    const plan: PlanVersion = {
      id: `plan-${crypto.randomUUID()}`, type: 'plan', updatedAt: '', deleted: false, deviceId: device.id,
      version, exteriorCourses: [...fields.exteriorCourses], interiorCourses: [...fields.interiorCourses],
      wall: structuredClone(fields.wall ?? cur.wall), note: fields.note, createdBy: device.id, createdAt: now(), archived: false,
    };
    if (name?.trim()) plan.name = name.trim();
    if (fields.rowMinimums && Object.keys(fields.rowMinimums).length) plan.rowMinimums = { ...fields.rowMinimums };
    return stamp(plan);
  }

  function newVersion(fields: PlanFields, records: AnyRecord[], name?: string): AnyRecord[] {
    const plan = makePlan(fields, name, records);
    return [plan, ...activate(plan, [...records, plan])];
  }

  /** One side replaced by a candidate; the other side, and its row minimum, kept from the plan in use. */
  function candidateFields(cand: Pick<CandidatePlan, 'side' | 'courses'>, records: AnyRecord[]): PlanFields {
    const cur = deriveState(records).plan;
    const rowMinimums: RowMinimums = { ...(cur.rowMinimums ?? {}) };
    delete rowMinimums[cand.side];
    return {
      exteriorCourses: cand.side === 'exterior' ? [...cand.courses] : [...cur.exteriorCourses],
      interiorCourses: cand.side === 'interior' ? [...cand.courses] : [...cur.interiorCourses],
      rowMinimums,
      note: `${cand.side === 'exterior' ? 'Exterior' : 'Interior'} courses changed`,
    };
  }

  const planById = (id: Id | null | undefined, records: AnyRecord[]) =>
    records.find((r): r is PlanVersion => r.type === 'plan' && r.id === id && !r.deleted);

  return {
    submitTree(input: TreeInput, records: AnyRecord[]): { tree: Tree; logs: LogCut[] } {
      const d = deriveState(records);
      const s = d.settings;
      const profile = buildProfile(input.lengthFt, input.buttCirc, input.readings, s.topCirc);
      const waist = waistCirc(profile, s);
      const plan = planTree(profile, d.remaining, s);
      const predictedProfile = predictProfile(waist, d.trees, s);
      const predictedPlan = planTree(predictedProfile, d.remaining, s);
      const id = crypto.randomUUID();
      const createdAt = now();
      const tree = stamp<Tree>({
        id, type: 'tree', updatedAt: '', deleted: false, deviceId: device.id, createdAt,
        lengthFt: input.lengthFt, buttCirc: input.buttCirc, readings: [...input.readings], waistCirc: waist, plan,
        predicted: {
          readings: readingStations(input.lengthFt).map((x) => round1(circAt(predictedProfile, x))),
          lengthFt: predictedProfile.lengthFt,
          largeLogs: largestClassCount(predictedPlan, d.remaining),
        },
        actualLargeLogs: largestClassCount(plan, d.remaining),
        warningsOverridden: input.warningsOverridden,
        notes: input.notes ?? '',
      });
      const logs = plan.cuts.map((c) =>
        stamp<LogCut>({
          id: crypto.randomUUID(), type: 'log', updatedAt: '', deleted: false, deviceId: device.id,
          source: 'tree', treeId: id, lengthFt: c.lengthFt, smallCirc: c.smallCirc, quantity: 1, createdAt,
        }),
      );
      return { tree, logs };
    },

    undoSubmit(treeId: Id, records: AnyRecord[]): AnyRecord[] {
      return records
        .filter((r) => !r.deleted && ((r.type === 'tree' && r.id === treeId) || (r.type === 'log' && r.treeId === treeId)))
        .map(tomb);
    },

    addManualLog(input: { lengthFt: number; smallCirc: number; quantity: number }): AnyRecord[] {
      return [
        stamp<LogCut>({
          id: crypto.randomUUID(), type: 'log', updatedAt: '', deleted: false, deviceId: device.id, source: 'manual', treeId: null,
          lengthFt: Math.ceil(input.lengthFt - 1e-9), smallCirc: input.smallCirc, quantity: Math.max(1, Math.round(input.quantity)), createdAt: now(),
        }),
      ];
    },

    updateRecord<T extends AnyRecord>(rec: T, patch: Partial<T>, records: AnyRecord[]): AnyRecord[] {
      let next = { ...rec, ...patch } as AnyRecord;
      if (next.type === 'tree') next = { ...next, waistCirc: treeWaist(next, deriveState(records).settings) };
      if (next.type === 'log') next = { ...next, lengthFt: Math.ceil(next.lengthFt - 1e-9) };
      if (next.type === 'need' && next.planVersionId !== null) next = { ...next, manuallyEdited: true };
      return [stamp(next)];
    },

    deleteRecord(rec: AnyRecord, records: AnyRecord[]): AnyRecord[] {
      if (rec.type === 'tree') return this.undoSubmit(rec.id, records);
      return [tomb(rec)];
    },

    addNeedRow(input: { lengthFt: number; minCirc: number; quantity: number }): AnyRecord[] {
      return [
        stamp<NeedRow>({
          id: crypto.randomUUID(), type: 'need', updatedAt: '', deleted: false, deviceId: device.id,
          lengthFt: Math.ceil(input.lengthFt - 1e-9), minCirc: input.minCirc, quantity: input.quantity, planVersionId: null, manuallyEdited: true,
        }),
      ];
    },

    acceptPlan(cand: Pick<CandidatePlan, 'side' | 'courses'>, records: AnyRecord[], name?: string): AnyRecord[] {
      return newVersion(candidateFields(cand, records), records, name);
    },

    /** Keep a candidate as a saved plan without using it. */
    saveCandidate(cand: Pick<CandidatePlan, 'side' | 'courses'>, name: string, records: AnyRecord[]): AnyRecord[] {
      return [makePlan(candidateFields(cand, records), name, records)];
    },

    /** Save a whole plan (for example the plan from my logs) without using it. */
    savePlan(fields: PlanFields, name: string, records: AnyRecord[]): AnyRecord[] {
      return [makePlan(fields, name, records)];
    },

    editWalls(wall: WallSettings, records: AnyRecord[]): AnyRecord[] {
      const cur = deriveState(records).plan;
      return newVersion(
        { exteriorCourses: [...cur.exteriorCourses], interiorCourses: [...cur.interiorCourses], rowMinimums: cur.rowMinimums, wall, note: 'Wall measurements changed' },
        records,
      );
    },

    usePlan(planId: Id, records: AnyRecord[]): AnyRecord[] {
      const target = planById(planId, records);
      return target ? activate(target, records) : [];
    },

    /** Go back to the plan used before the current one. */
    switchBack(records: AnyRecord[]): AnyRecord[] {
      const active = records.find((r): r is ActivePlan => r.type === 'active')!;
      const prev = planById(active.previousPlanId, records);
      return prev ? activate(prev, records) : [];
    },

    renamePlan(plan: PlanVersion, name: string, _records: AnyRecord[]): AnyRecord[] {
      const n = name.trim();
      return n ? [stamp({ ...plan, name: n })] : [];
    },

    setArchived(plan: PlanVersion, archived: boolean, records: AnyRecord[]): AnyRecord[] {
      if (archived && deriveState(records).plan.id === plan.id) return [];
      return [stamp({ ...plan, archived })];
    },

    /** The plan in use was deleted on the other phone: keep it, and its rows, because it is still in use here. */
    repairActivePlan(records: AnyRecord[]): AnyRecord[] {
      const d = deriveState(records);
      if (!d.activePlanDeleted) return [];
      const plan = { ...d.plan, deleted: false };
      const hasRows = records.some((r) => r.type === 'need' && !r.deleted && r.planVersionId === plan.id);
      return [stamp(plan), ...(hasRows ? [] : rowsFor(plan, records))];
    },

    deletePlan(plan: PlanVersion, records: AnyRecord[]): AnyRecord[] {
      if (deriveState(records).plan.id === plan.id) return [];
      const rows = records.filter((r) => r.type === 'need' && !r.deleted && r.planVersionId === plan.id);
      return [tomb(plan), ...rows.map(tomb)];
    },

    /** Add a plan from a plan file, unless the same plan is already in the list. Never switches to it. */
    importPlan(incoming: PlanVersion, records: AnyRecord[]): { changed: AnyRecord[]; duplicateOf: PlanVersion | null } {
      const existing = records.find((r): r is PlanVersion => r.type === 'plan' && !r.deleted && samePlan(r, incoming));
      if (existing) return { changed: [], duplicateOf: existing };
      const plan = makePlan(
        { exteriorCourses: incoming.exteriorCourses, interiorCourses: incoming.interiorCourses, wall: incoming.wall, rowMinimums: incoming.rowMinimums, note: incoming.note },
        incoming.name ?? 'Imported plan',
        records,
      );
      return { changed: [plan], duplicateOf: null };
    },

    updateSettings(patch: Partial<SettingsValues>, records: AnyRecord[]): AnyRecord[] {
      const s = records.find((r): r is Settings => r.type === 'settings')!;
      return [stamp({ ...s, ...patch })];
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
