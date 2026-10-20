import { describe, expect, it } from 'vitest';
import { planTree, planYield, rowWeight } from '../../src/core/planner';
import { buildProfile, circAt } from '../../src/core/profile';
import { generateRows } from '../../src/core/wall';
import { DEFAULT_WALL, PLAN_V1_COURSES } from '../../src/core/seed';
import { rowKey } from '../../src/core/types';
import type { PlannerRow, Profile } from '../../src/core/types';
import { prng } from '../helpers/prng';

const S = { kerfIn: 0.375, buttTrimIn: 2 };
const synthetic = () => buildProfile(34, 42.4, [34.6, 30.2, 26.4, 22.0, 17.6], 12.6);
const v1Rows = (): PlannerRow[] =>
  generateRows(PLAN_V1_COURSES.exterior, PLAN_V1_COURSES.interior, DEFAULT_WALL).map((r) => ({
    key: rowKey(r.lengthFt, r.minCirc), lengthFt: r.lengthFt, minCirc: r.minCirc, remaining: r.quantity, quantity: r.quantity,
  }));
const row = (lengthFt: number, minCirc: number, remaining: number, quantity = remaining): PlannerRow => ({
  key: rowKey(lengthFt, minCirc), lengthFt, minCirc, remaining, quantity,
});

describe('planTree on the synthetic tree', () => {
  const p = synthetic();
  const plan = planTree(p, v1Rows(), S);

  it('cuts at least two logs', () => expect(plan.cuts.length).toBeGreaterThanOrEqual(2));
  it('only cuts logs whose small end meets the row minimum', () => {
    const rows = new Map(v1Rows().map((r) => [r.key, r]));
    for (const c of plan.cuts) expect(circAt(p, c.endIn / 12)).toBeGreaterThanOrEqual(rows.get(c.rowKey)!.minCirc);
  });
  it('records the expected small-end circumference rounded to 0.1 in', () => {
    for (const c of plan.cuts) expect(c.smallCirc).toBeCloseTo(Math.round(circAt(p, c.endIn / 12) * 10) / 10, 9);
  });
  it('cuts back to back from the butt trim with one kerf between pieces', () => {
    expect(plan.cuts[0].startIn).toBe(2);
    for (let i = 1; i < plan.cuts.length; i++) expect(plan.cuts[i].startIn).toBeCloseTo(plan.cuts[i - 1].endIn + 0.375, 9);
    for (const c of plan.cuts) expect(c.endIn - c.startIn).toBe(c.lengthFt * 12);
    expect(plan.cuts.at(-1)!.endIn).toBeLessThanOrEqual(408);
  });
  it('reports what is left at the top', () => {
    const last = plan.cuts.at(-1)!;
    expect(plan.leftover.startIn).toBeCloseTo(last.endIn + 0.375, 9);
    expect(plan.leftover.lengthIn).toBeCloseTo(Math.max(0, 408 - plan.leftover.startIn), 9);
    expect(plan.leftover.topCirc).toBe(12.6);
  });
});

describe('planTree limits', () => {
  it('never uses a row more than its remaining count', () => {
    const plan = planTree(synthetic(), [row(16, 28.3, 1, 8)], S);
    expect(planYield(plan).get('16|28.3') ?? 0).toBeLessThanOrEqual(1);
  });
  it('returns no cuts for a tree too short for any piece', () => {
    const plan = planTree(buildProfile(3, 30, [], 12.6), v1Rows(), S);
    expect(plan.cuts).toEqual([]);
    expect(plan.leftover).toEqual({ startIn: 2, lengthIn: 34, topCirc: 12.6 });
  });
  it('returns no cuts when the trunk is thinner than every row minimum', () => {
    const plan = planTree(buildProfile(20, 14, [13.5, 13], 12.6), [row(4, 18.9, 3)], S);
    expect(plan.cuts).toEqual([]);
  });
});

// Exhaustive search over every sequence of pieces, used to check the planner's optimum.
function bruteBest(p: Profile, rows: PlannerRow[]): number {
  const used = rows.map(() => 0);
  const go = (pos: number): number => {
    let best = 0;
    rows.forEach((r, i) => {
      if (used[i] >= r.remaining) return;
      const end = pos + 12 * r.lengthFt;
      if (end > 12 * p.lengthFt + 1e-9 || circAt(p, end / 12) < r.minCirc - 1e-9) return;
      const w = rowWeight(r, r.remaining - used[i]);
      used[i]++;
      best = Math.max(best, w + go(end + S.kerfIn));
      used[i]--;
    });
    return best;
  };
  return go(S.buttTrimIn);
}

describe('planTree is optimal', () => {
  it('matches exhaustive search on 200 random small cases', () => {
    const rand = prng(42);
    const classes = [12.6, 15.8, 18.9, 25.2, 28.3];
    let withCuts = 0;
    for (let k = 0; k < 200; k++) {
      const lengthFt = 10 + Math.floor(rand() * 21);
      let c = 25 + rand() * 20;
      const readings = [6, 12, 18, 24, 30].filter((x) => x < lengthFt).map(() => (c = Math.max(12.6, c - rand() * 6)));
      const p = buildProfile(lengthFt, 25 + rand() * 25 > c ? c + rand() * 8 : c, readings, 12.6);
      p.points[0].circ = Math.max(p.points[0].circ, p.points[1]?.circ ?? 12.6);
      const nRows = 1 + Math.floor(rand() * 4);
      const rows: PlannerRow[] = [];
      for (let i = 0; i < nRows; i++) {
        const r = row(4 + Math.floor(rand() * 13), classes[Math.floor(rand() * classes.length)], 1 + Math.floor(rand() * 3));
        if (!rows.some((x) => x.key === r.key)) rows.push(r);
      }
      const plan = planTree(p, rows, S);
      if (plan.cuts.length > 1) withCuts++;
      const value = plan.cuts.reduce((s, cut, i) => {
        const r = rows.find((x) => x.key === cut.rowKey)!;
        const before = plan.cuts.slice(0, i).filter((x) => x.rowKey === cut.rowKey).length;
        return s + rowWeight(r, r.remaining - before);
      }, 0);
      expect(value).toBeCloseTo(bruteBest(p, rows), 9);
    }
    expect(withCuts).toBeGreaterThan(50); // the cases must exercise real multi-piece choices
  });
});
