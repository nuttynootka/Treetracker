import { Clock } from '../core/hlc';
import { planTree } from '../core/planner';
import { buildProfile, circAt, readingStations, waistCirc } from '../core/profile';
import { predictProfile } from '../core/predict';
import { largestClassCount } from '../core/recommend';
import { needRowId } from '../core/seed';
import { generateRows } from '../core/wall';
import { round1 } from '../core/num';
import type { CandidatePlan } from '../core/recalc';
import type { AnyRecord, Id, LogCut, NeedRow, PlanVersion, SettingsValues, Tree, WallSettings, ActivePlan, Settings } from '../core/types';
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
    return generateRows(plan.exteriorCourses, plan.interiorCourses, plan.wall).map((g) => {
      const id = needRowId(plan.id, g.lengthFt, g.minCirc);
      const prev = existing.get(id) as NeedRow | undefined;
      return stamp({ ...(prev ?? {}), id, type: 'need', deleted: false, ...g, planVersionId: plan.id, manuallyEdited: false } as NeedRow);
    });
  }

  function activate(target: PlanVersion, records: AnyRecord[]): AnyRecord[] {
    const d = deriveState(records);
    const oldRows = records.filter((r): r is NeedRow => r.type === 'need' && !r.deleted && r.planVersionId === d.plan.id);
    const active = records.find((r): r is ActivePlan => r.type === 'active')!;
    return [...oldRows.map(tomb), ...rowsFor(target, records), stamp({ ...active, planVersionId: target.id })];
  }

  function newVersion(fields: Pick<PlanVersion, 'exteriorCourses' | 'interiorCourses' | 'wall' | 'note'>, records: AnyRecord[]): AnyRecord[] {
    const version = Math.max(...records.filter((r): r is PlanVersion => r.type === 'plan').map((p) => p.version)) + 1;
    const plan = stamp<PlanVersion>({
      id: `plan-${crypto.randomUUID()}`, type: 'plan', updatedAt: '', deleted: false, deviceId: device.id,
      version, ...fields, createdBy: device.id, createdAt: now(),
    });
    return [plan, ...activate(plan, [...records, plan])];
  }

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

    acceptPlan(cand: Pick<CandidatePlan, 'side' | 'courses'>, records: AnyRecord[]): AnyRecord[] {
      const cur = deriveState(records).plan;
      return newVersion(
        {
          exteriorCourses: cand.side === 'exterior' ? [...cand.courses] : [...cur.exteriorCourses],
          interiorCourses: cand.side === 'interior' ? [...cand.courses] : [...cur.interiorCourses],
          wall: structuredClone(cur.wall),
          note: `${cand.side === 'exterior' ? 'Exterior' : 'Interior'} courses changed`,
        },
        records,
      );
    },

    editWalls(wall: WallSettings, records: AnyRecord[]): AnyRecord[] {
      const cur = deriveState(records).plan;
      return newVersion({ exteriorCourses: [...cur.exteriorCourses], interiorCourses: [...cur.interiorCourses], wall: structuredClone(wall), note: 'Wall measurements changed' }, records);
    },

    undoPlan(records: AnyRecord[]): AnyRecord[] {
      const d = deriveState(records);
      const prev = d.plans[d.plans.findIndex((p) => p.id === d.plan.id) - 1];
      return prev ? activate(prev, records) : [];
    },

    updateSettings(patch: Partial<SettingsValues>, records: AnyRecord[]): AnyRecord[] {
      const s = records.find((r): r is Settings => r.type === 'settings')!;
      return [stamp({ ...s, ...patch })];
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
