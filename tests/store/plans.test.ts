import { describe, expect, it } from 'vitest';
import { createActions } from '../../src/store/actions';
import { deriveState } from '../../src/store/derive';
import { Clock } from '../../src/core/hlc';
import { seedRecords } from '../../src/core/seed';
import { candidatePlans, comparePlanFromLogs } from '../../src/core/recalc';
import { planFromLogs } from '../../src/core/logsplan';
import type { ActivePlan, AnyRecord, PlanVersion } from '../../src/core/types';
import { log } from '../helpers/records';

let t = 1;
const actions = createActions(new Clock('dev', () => t++), { id: 'dev' }, () => t++);
function apply(recs: AnyRecord[], changed: AnyRecord[]) {
  const m = new Map(recs.map((r) => [r.id, r]));
  for (const r of changed) m.set(r.id, r);
  return [...m.values()];
}
const LOGS = [log(10, 29, 20), log(4, 15, 21)];
const withLogs = () => apply(seedRecords(), LOGS);
const plans = (recs: AnyRecord[]) => deriveState(recs).plans;

describe('saving the plan from my logs', () => {
  it('saves it without using it, then uses it with the 18.9 and 12.6 in minimums', () => {
    let r = withLogs();
    const lp = planFromLogs(LOGS, deriveState(r).plan);
    if (!lp.ok) throw new Error('expected a plan');
    r = apply(r, actions.savePlan({ exteriorCourses: lp.exteriorCourses, interiorCourses: lp.interiorCourses, rowMinimums: lp.rowMinimums, note: 'From my logs' }, 'From my logs', r));
    expect(plans(r).map((p) => p.name)).toEqual(['Starting plan', 'From my logs']);
    expect(deriveState(r).plan.id).toBe('plan-v1');
    const saved = plans(r)[1];
    r = apply(r, actions.usePlan(saved.id, r));
    const d = deriveState(r);
    expect(d.plan.id).toBe(saved.id);
    expect(new Set(d.activeRows.map((x) => x.minCirc))).toEqual(new Set([18.9, 12.6]));
    expect(d.totals.needed).toBe(9 * 7 + 18 * 4);
    expect((r.find((x) => x.type === 'active') as ActivePlan).previousPlanId).toBe('plan-v1');
  });

  it('compares the plan from logs with the rows in use', () => {
    const r = withLogs();
    const d = deriveState(r);
    const lp = planFromLogs(LOGS, d.plan);
    if (!lp.ok) throw new Error('expected a plan');
    const c = comparePlanFromLogs(lp, { logs: d.logs, trees: [], s: d.settings, rows: d.activeRows });
    expect(c.deltaPieces).toBe(135 - 138);
    expect(c.logsTotal).toBe(41);
    expect(c.logsStillCounting).toBeGreaterThan(0);
  });
});

describe('the plans list', () => {
  const twoPlans = () => {
    let r = seedRecords();
    const cand = candidatePlans('exterior', [25.2], deriveState(r).plan)[0];
    r = apply(r, actions.saveCandidate(cand, 'All 25.2', r));
    return r;
  };

  it('switches back to the previous plan', () => {
    let r = twoPlans();
    const other = plans(r)[1];
    r = apply(r, actions.usePlan(other.id, r));
    r = apply(r, actions.switchBack(r));
    expect(deriveState(r).plan.id).toBe('plan-v1');
    expect(deriveState(r).totals.needed).toBe(138);
  });

  it('renames, archives and unarchives a plan', () => {
    let r = twoPlans();
    const other = plans(r)[1];
    r = apply(r, actions.renamePlan(other, 'Thin logs', r));
    r = apply(r, actions.setArchived(plans(r)[1], true, r));
    expect(plans(r)[1]).toMatchObject({ name: 'Thin logs', archived: true });
    r = apply(r, actions.setArchived(plans(r)[1], false, r));
    expect(plans(r)[1].archived).toBe(false);
  });

  it('will not archive or delete the plan in use', () => {
    const r = twoPlans();
    const inUse = deriveState(r).plan;
    expect(actions.setArchived(inUse, true, r)).toEqual([]);
    expect(actions.deletePlan(inUse, r)).toEqual([]);
  });

  it('deletes a plan that is not in use', () => {
    let r = twoPlans();
    r = apply(r, actions.deletePlan(plans(r)[1], r));
    expect(plans(r)).toHaveLength(1);
  });

  it('keeps the other side minimum when one side is replaced', () => {
    let r = withLogs();
    const lp = planFromLogs(LOGS, deriveState(r).plan);
    if (!lp.ok) throw new Error('expected a plan');
    r = apply(r, actions.savePlan({ exteriorCourses: lp.exteriorCourses, interiorCourses: lp.interiorCourses, rowMinimums: lp.rowMinimums, note: '' }, 'Logs', r));
    r = apply(r, actions.usePlan(plans(r)[1].id, r));
    const cand = candidatePlans('exterior', [28.3, 25.2], deriveState(r).plan)[0];
    r = apply(r, actions.acceptPlan(cand, r));
    expect(deriveState(r).plan.rowMinimums).toEqual({ interior: 12.6 });
  });

  it('imports a plan once and reports a duplicate', () => {
    const r = twoPlans();
    const incoming: PlanVersion = { ...plans(r)[1], id: 'from-file', name: 'Shared' };
    const dup = actions.importPlan(incoming, r);
    expect(dup.changed).toEqual([]);
    expect(dup.duplicateOf?.name).toBe('All 25.2');
    const fresh = actions.importPlan({ ...incoming, exteriorCourses: [...incoming.exteriorCourses, 25.2] }, r);
    expect(fresh.duplicateOf).toBeNull();
    const after = apply(r, fresh.changed);
    expect(plans(after)).toHaveLength(3);
    expect(deriveState(after).plan.id).toBe('plan-v1');
    expect(plans(after)[2]).toMatchObject({ name: 'Shared', archived: false, version: 3 });
    expect(plans(after)[2].id).not.toBe('from-file');
  });
});

describe('two phones changing plans', () => {
  it('keeps the plan in use when the other phone deleted it, and restores it', () => {
    let tt = 5000;
    const a = createActions(new Clock('A', () => tt++), { id: 'A' }, () => tt++);
    const b = createActions(new Clock('B', () => tt++), { id: 'B' }, () => tt++);
    let base = seedRecords();
    const cand = candidatePlans('exterior', [25.2], deriveState(base).plan)[0];
    base = apply(base, a.saveCandidate(cand, 'X', base));
    const x = plans(base)[1];
    const phoneA = apply(base, a.usePlan(x.id, base)); // A switches to X
    const phoneB = apply(base, b.deletePlan(x, base)); // B, not yet synced, deletes X
    const merged = apply(phoneA, phoneB.filter((r) => r.id === x.id || (r.type === 'need' && r.planVersionId === x.id)));
    const d = deriveState(merged);
    expect(d.plan.id).toBe(x.id);
    expect(d.activePlanDeleted).toBe(true);
    expect(d.totals.needed).toBe(77 + 68);
    const repaired = apply(merged, a.repairActivePlan(merged));
    const r = deriveState(repaired);
    expect(r.activePlanDeleted).toBe(false);
    expect(r.plans.map((p) => p.id)).toContain(x.id);
    expect(r.totals.needed).toBe(77 + 68);
  });

  it('rebuilds the rows of the plan in use if they are missing', () => {
    let r = seedRecords();
    r = r.map((x) => (x.type === 'need' ? { ...x, deleted: true } : x));
    expect(deriveState(r).totals.needed).toBe(0);
    r = apply(r, actions.usePlan('plan-v1', r));
    expect(deriveState(r).totals.needed).toBe(138);
  });
});
