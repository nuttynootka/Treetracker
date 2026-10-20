import { describe, expect, it } from 'vitest';
import { candidateWaists, largestClassCount, recommend } from '../../src/core/recommend';
import { planTree, planYield } from '../../src/core/planner';
import { buildProfile } from '../../src/core/profile';
import { DEFAULT_SETTINGS as S } from '../../src/core/seed';
import { rowKey } from '../../src/core/types';
import type { PlannerRow } from '../../src/core/types';
import { v1PlannerRows } from '../helpers/rows';
import { tree } from '../helpers/trees';

describe('candidateWaists', () => {
  it('steps 1 in from 22 and always includes the maximum', () => {
    const c = candidateWaists(37.7);
    expect(c[0]).toBe(22);
    expect(c.at(-2)).toBe(37);
    expect(c.at(-1)).toBe(37.7);
    expect(candidateWaists(30)).toEqual([22, 23, 24, 25, 26, 27, 28, 29, 30]);
  });
});

describe('recommend', () => {
  it('suggests 3 trees and a finite estimate for the starting list', () => {
    const r = recommend(v1PlannerRows(), [], S);
    expect(r.next).toHaveLength(3);
    for (const w of r.next) expect(candidateWaists(37.7).map((c) => Math.round(c * 10) / 10)).toContain(w);
    expect(r.treesNeeded).not.toBeNull();
    expect(r.spare).toBe(Math.ceil(r.treesNeeded! * 0.1));
    expect(r.unfillable).toEqual([]);
  });

  it('needs no more trees after a tree has been cut', () => {
    const rows = v1PlannerRows();
    const before = recommend(rows, [], S).treesNeeded!;
    const plan = planTree(buildProfile(34, 42.4, [34.6, 30.2, 26.4, 22.0, 17.6], 12.6), rows, S);
    const y = planYield(plan);
    const after = recommend(rows.map((r) => ({ ...r, remaining: r.remaining - (y.get(r.key) ?? 0) })).filter((r) => r.remaining > 0), [], S);
    expect(after.treesNeeded!).toBeLessThanOrEqual(before);
  });

  it('suggests the smallest tree when only a small log is left', () => {
    const rows: PlannerRow[] = [{ key: rowKey(4, 12.6), lengthFt: 4, minCirc: 12.6, remaining: 1, quantity: 10 }];
    expect(recommend(rows, [], S).next).toEqual([22]);
  });

  it('reports rows that no tree up to the maximum can supply', () => {
    const r = recommend(v1PlannerRows(), [], S, { maxWaist: 34.6 });
    expect(r.treesNeeded).toBeNull();
    expect(r.unfillable).toContain('16|28.3');
  });
});

describe('recommend after a short first tree', () => {
  it('still recommends trees when the only measured tree is a 3 ft butt section', () => {
    const r = recommend(v1PlannerRows(), [tree(3, 40, [])], S);
    expect(r.next).toHaveLength(3);
    expect(r.treesNeeded).not.toBeNull();
  });
});

describe('largestClassCount', () => {
  it('counts pieces in the largest circumference class among the rows', () => {
    const rows = v1PlannerRows();
    const plan = planTree(buildProfile(34, 42.4, [34.6, 30.2, 26.4, 22.0, 17.6], 12.6), rows, S);
    expect(largestClassCount(plan, rows)).toBe(plan.cuts.filter((c) => c.rowKey.endsWith('|28.3')).length);
  });
});
