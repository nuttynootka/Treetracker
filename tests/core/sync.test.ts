import { describe, expect, it } from 'vitest';
import { buildExport, mergeRecords, parseSyncFile, SyncError, syncFileName } from '../../src/core/sync';
import { Clock } from '../../src/core/hlc';
import { seedRecords } from '../../src/core/seed';
import type { AnyRecord, NeedRow } from '../../src/core/types';
import { log } from '../helpers/records';
import { syntheticTree } from '../helpers/trees';

const byId = (recs: AnyRecord[]) => new Map(recs.map((r) => [r.id, r]));
function apply(local: AnyRecord[], changed: AnyRecord[]): AnyRecord[] {
  const m = byId(local);
  for (const r of changed) m.set(r.id, r);
  return [...m.values()].sort((a, b) => a.id.localeCompare(b.id));
}
function importInto(local: AnyRecord[], from: AnyRecord[], device = { id: 'x', name: 'X' }) {
  const file = parseSyncFile(JSON.stringify(buildExport(from, device, 1)));
  const res = mergeRecords(local, file.records);
  return { recs: apply(local, res.changed), res };
}

describe('two phones syncing by file', () => {
  it('end with identical records and one copy of the seeded plan', () => {
    let t = 1_000;
    const ca = new Clock('A', () => t);
    const cb = new Clock('B', () => t);
    let a = apply([], seedRecords());
    let b = apply([], seedRecords());
    const row = a.find((r) => r.type === 'need') as NeedRow;
    a = apply(a, [syntheticTree({ id: 'tree-a', updatedAt: ca.tick(), deviceId: 'A' }), { ...row, quantity: 5, updatedAt: ca.tick(), deviceId: 'A' }]);
    t = 2_000;
    b = apply(b, [log(8, 26, 3, { id: 'log-b', updatedAt: cb.tick(), deviceId: 'B' }), { ...row, quantity: 9, updatedAt: cb.tick(), deviceId: 'B' }]);

    const aAfter = importInto(a, b).recs;
    const bAfter = importInto(b, a).recs;
    expect(aAfter).toEqual(bAfter);
    expect((aAfter.find((r) => r.id === row.id) as NeedRow).quantity).toBe(9);
    expect(aAfter.filter((r) => r.type === 'need')).toHaveLength(17);
    expect(aAfter.filter((r) => r.type === 'plan')).toHaveLength(1);
  });

  it('changes nothing when the same file is imported twice', () => {
    const c = new Clock('B', () => 5);
    const b = apply(seedRecords(), [log(8, 26, 1, { id: 'l1', updatedAt: c.tick() })]);
    const first = importInto(seedRecords(), b);
    expect(first.res.added).toBe(1);
    expect(importInto(first.recs, b).res.changed).toEqual([]);
  });

  it('keeps a tree deleted when an older file still has it', () => {
    let t = 10;
    const c = new Clock('A', () => t);
    const live = syntheticTree({ id: 'tree-1', updatedAt: c.tick() });
    const oldFile = apply(seedRecords(), [live]);
    t = 20;
    const a = apply(oldFile, [{ ...live, deleted: true, updatedAt: c.tick() }]);
    const after = importInto(a, oldFile).recs;
    expect(after.find((r) => r.id === 'tree-1')!.deleted).toBe(true);
  });

  it('treats a phone importing its own export as a no-op', () => {
    const a = apply(seedRecords(), [log(4, 13, 1, { id: 'l', updatedAt: new Clock('A', () => 3).tick() })]);
    expect(importInto(a, a).res.changed).toEqual([]);
  });

  it('reports when the active wall plan changed', () => {
    const active = seedRecords().find((r) => r.type === 'active')!;
    const b = apply(seedRecords(), [{ ...active, planVersionId: 'plan-2', updatedAt: new Clock('B', () => 9).tick() } as AnyRecord]);
    expect(importInto(seedRecords(), b).res.activePlanChanged).toBe(true);
  });

  it('counts deletions', () => {
    const c = new Clock('A', () => 3);
    const l = log(4, 13, 1, { id: 'l', updatedAt: c.tick() });
    const a = apply(seedRecords(), [l]);
    const b = apply(seedRecords(), [{ ...l, deleted: true, updatedAt: c.tick() }]);
    expect(importInto(a, b).res.deleted).toBe(1);
  });
});

describe('parseSyncFile', () => {
  it('rejects text that is not JSON', () => expect(() => parseSyncFile('{')).toThrow(SyncError));
  it('rejects a file from another app', () => expect(() => parseSyncFile('{"format":"x"}')).toThrow(SyncError));
  it('rejects a file with a damaged record and names it', () => {
    const file = buildExport([...seedRecords(), { id: 'bad-tree', type: 'tree', updatedAt: 'x', deleted: false, deviceId: 'a' } as unknown as AnyRecord], { id: 'a', name: 'A' }, 1);
    expect(() => parseSyncFile(JSON.stringify(file))).toThrow(/damaged.*bad-tree/);
  });
  it('accepts a normal export with trees and logs', () => {
    const file = buildExport([...seedRecords(), syntheticTree(), log(8, 26)], { id: 'a', name: 'A' }, 1);
    expect(parseSyncFile(JSON.stringify(file)).records).toHaveLength(seedRecords().length + 2);
  });
  it('rejects a newer file version', () =>
    expect(() => parseSyncFile(JSON.stringify({ ...buildExport([], { id: 'a', name: 'A' }, 1), version: 2 }))).toThrow(/newer/));
});

describe('syncFileName', () => {
  it('names the file by device and time', () =>
    expect(syncFileName("Jess's phone", Date.UTC(2026, 9, 20, 14, 5))).toMatch(/^treetracker-sync-jess-s-phone-2026-10-20-\d{4}\.json$/));
});
