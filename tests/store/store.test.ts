import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openRepo } from '../../src/store/db';
import { deriveState } from '../../src/store/derive';
import { createActions } from '../../src/store/actions';
import { Clock } from '../../src/core/hlc';
import { seedRecords } from '../../src/core/seed';
import { predictProfile } from '../../src/core/predict';
import { candidatePlans } from '../../src/core/recalc';
import type { AnyRecord, LogCut, PlanVersion, Tree } from '../../src/core/types';

const SYNTH = { lengthFt: 34, buttCirc: 42.4, readings: [34.6, 30.2, 26.4, 22.0, 17.6], warningsOverridden: false };
const toCut = (recs: AnyRecord[]) => deriveState(recs).rowViews.reduce((a, v) => a + v.toCut, 0);
let t = 1;
const setup = () => {
  const clock = new Clock('dev', () => t++);
  return { actions: createActions(clock, { id: 'dev' }, () => t++), recs: seedRecords() };
};
function apply(recs: AnyRecord[], changed: AnyRecord[]) {
  const m = new Map(recs.map((r) => [r.id, r]));
  for (const r of changed) m.set(r.id, r);
  return [...m.values()];
}

describe('repo', () => {
  it('seeds a fresh database with the 138-log starting list', async () => {
    const repo = await openRepo('fresh-1');
    const d = deriveState(await repo.all());
    expect(d.activeRows).toHaveLength(17);
    expect(d.totals.needed).toBe(138);
  });
  it('keeps records after reopening', async () => {
    const a = await openRepo('persist-1');
    const { actions, recs } = setup();
    await a.put(actions.addManualLog({ lengthFt: 8, smallCirc: 26, quantity: 2 }));
    const b = await openRepo('persist-1');
    expect((await b.all()).filter((r) => r.type === 'log')).toHaveLength(1);
    expect(recs).toBeTruthy();
  });
});

describe('actions and derived totals', () => {
  it('submitting a tree adds its logs and undo reverses it', () => {
    const { actions, recs } = setup();
    const { tree, logs } = actions.submitTree(SYNTH, recs);
    const after = apply(recs, [tree, ...logs]);
    expect(logs.length).toBe(tree.plan.cuts.length);
    expect(toCut(after)).toBe(138 - logs.length);
    expect(tree.waistCirc).toBeCloseTo(38.5, 2);
    expect(tree.predicted).not.toBeNull();
    expect(toCut(apply(after, actions.undoSubmit(tree.id, after)))).toBe(138);
  });

  it('deleting a tree removes its logs from what we have', () => {
    const { actions, recs } = setup();
    const { tree, logs } = actions.submitTree(SYNTH, recs);
    const after = apply(recs, [tree, ...logs]);
    const gone = apply(after, actions.deleteRecord(tree, after));
    expect(toCut(gone)).toBe(138);
    expect(deriveState(gone).trees).toHaveLength(0);
  });

  it('a log edited below its row minimum stops counting for that row', () => {
    const { actions, recs } = setup();
    const [l] = actions.addManualLog({ lengthFt: 16, smallCirc: 29, quantity: 1 }) as LogCut[];
    let r = apply(recs, [l]);
    const row = () => deriveState(r).rowViews.find((v) => v.row.lengthFt === 16 && v.row.minCirc === 28.3)!;
    expect(row().have).toBe(1);
    r = apply(r, actions.updateRecord(l, { smallCirc: 27 }, r));
    expect(row().have).toBe(0);
  });

  it('rounds a manual log up to whole feet', () => {
    const { actions } = setup();
    expect((actions.addManualLog({ lengthFt: 9.2, smallCirc: 26, quantity: 1 })[0] as LogCut).lengthFt).toBe(10);
  });

  it('manual logs do not change the predictions', () => {
    const { actions, recs } = setup();
    const { tree, logs } = actions.submitTree(SYNTH, recs);
    const base = apply(recs, [tree, ...logs]);
    const withManual = apply(base, actions.addManualLog({ lengthFt: 16, smallCirc: 40, quantity: 5 }));
    const s = deriveState(base).settings;
    expect(predictProfile(35, deriveState(withManual).trees, s)).toEqual(predictProfile(35, deriveState(base).trees, s));
  });

  it('never shows negative still-to-cut and lists surplus logs as extras', () => {
    const { actions, recs } = setup();
    const r = apply(recs, actions.addManualLog({ lengthFt: 16, smallCirc: 30, quantity: 20 }));
    const d = deriveState(r);
    const row = d.rowViews.find((v) => v.row.lengthFt === 16 && v.row.minCirc === 28.3)!;
    expect(row.have).toBe(8);
    expect(row.toCut).toBe(0);
    expect(d.rowViews.every((v) => v.toCut >= 0)).toBe(true);
    expect(d.extras.reduce((a, e) => a + e.count, 0)).toBe(20 - 8 - 12);
  });

  it('accepting a new plan regenerates rows, keeps logs, and can be undone', () => {
    const { actions, recs } = setup();
    let r = apply(recs, actions.addManualLog({ lengthFt: 16, smallCirc: 30, quantity: 8 }));
    const plan = deriveState(r).plan as PlanVersion;
    const cand = candidatePlans('exterior', [25.2], plan)[0];
    r = apply(r, actions.acceptPlan(cand, r));
    const d = deriveState(r);
    expect(d.plan.version).toBe(2);
    expect(d.totals.needed).toBe(77 + 68);
    expect(d.logs.reduce((a, l) => a + l.quantity, 0)).toBe(8);
    expect(d.rowViews.find((v) => v.row.lengthFt === 16 && v.row.minCirc === 25.2)!.have).toBe(8);
    r = apply(r, actions.undoPlan(r));
    const u = deriveState(r);
    expect(u.plan.version).toBe(1);
    expect(u.totals.needed).toBe(138);
    expect(u.activeRows).toHaveLength(17);
  });

  it('editing a tree recomputes its waist estimate but keeps its plan', () => {
    const { actions, recs } = setup();
    const { tree, logs } = actions.submitTree(SYNTH, recs);
    const r = apply(recs, [tree, ...logs]);
    const [edited] = actions.updateRecord(tree, { buttCirc: 44.4 }, r) as Tree[];
    expect(edited.waistCirc).toBeCloseTo(39.5, 2);
    expect(edited.plan).toEqual(tree.plan);
  });

  it('marks a hand-edited generated row', () => {
    const { actions, recs } = setup();
    const row = deriveState(recs).activeRows[0];
    expect(actions.updateRecord(row, { quantity: 3 }, recs)[0]).toMatchObject({ quantity: 3, manuallyEdited: true });
  });

  it('stamps every change with a newer clock and this device', () => {
    const { actions, recs } = setup();
    const [l] = actions.addManualLog({ lengthFt: 4, smallCirc: 13, quantity: 1 });
    expect(l.deviceId).toBe('dev');
    expect(l.updatedAt > recs[0].updatedAt).toBe(true);
  });
});
