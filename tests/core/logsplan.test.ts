import { describe, expect, it } from 'vitest';
import { planFromLogs } from '../../src/core/logsplan';
import { generateRows } from '../../src/core/wall';
import { DEFAULT_WALL, seedRecords } from '../../src/core/seed';
import type { PlanVersion } from '../../src/core/types';
import { log } from '../helpers/records';

const v1 = () => seedRecords().find((r) => r.type === 'plan') as PlanVersion;

describe('generateRows with row minimums', () => {
  it('uses each side minimum instead of the course circumference', () => {
    const rows = generateRows([27.6, 27.6], [15.0], DEFAULT_WALL, { exterior: 18.9, interior: 12.6 });
    expect(new Set(rows.map((r) => r.minCirc))).toEqual(new Set([18.9, 12.6]));
    expect(rows.find((r) => r.lengthFt === 16)).toMatchObject({ minCirc: 18.9, quantity: 4 });
    expect(rows.find((r) => r.lengthFt === 4)).toMatchObject({ minCirc: 12.6, quantity: 2 });
  });
});

describe('planFromLogs', () => {
  it('needs more than 40 logs', () => {
    const r = planFromLogs([log(10, 29, 20), log(4, 15, 20)], v1());
    expect(r).toEqual({ ok: false, count: 40 });
  });

  it('averages the 20 largest for exterior and the 20 smallest for interior', () => {
    const r = planFromLogs([log(10, 29, 20), log(4, 15, 21)], v1());
    if (!r.ok) throw new Error('expected a plan');
    expect(r.exteriorAvg).toBe(29);
    expect(r.interiorAvg).toBe(15);
    expect(r.exteriorCourses).toEqual(Array(9).fill(29));
    expect(r.exteriorHeightIn).toBeCloseTo(83.08, 1);
    expect(r.interiorCourses).toEqual(Array(18).fill(15));
    expect(r.interiorHeightIn).toBeCloseTo(85.94, 1);
    expect(r.rowMinimums).toEqual({ exterior: 18.9, interior: 12.6 });
    expect(new Set(r.rows.map((x) => x.minCirc))).toEqual(new Set([18.9, 12.6]));
    expect(r.rows.reduce((a, x) => a + x.quantity, 0)).toBe(9 * 7 + 18 * 4);
  });

  it('adds a course when the closest count is under 82 in', () => {
    const r = planFromLogs([log(10, 36.13, 20), log(4, 15, 21)], v1());
    if (!r.ok) throw new Error('expected a plan');
    expect(r.exteriorCourses).toHaveLength(8);
    expect(r.exteriorAdded).toBe(true);
    expect(r.interiorAdded).toBe(false);
  });

  it('flags an average below the row minimum', () => {
    const r = planFromLogs([log(10, 17, 20), log(4, 11, 21)], v1());
    if (!r.ok) throw new Error('expected a plan');
    expect(r.exteriorBelowMinimum).toBe(true);
    expect(r.interiorBelowMinimum).toBe(true);
    const ok = planFromLogs([log(10, 29, 20), log(4, 15, 21)], v1());
    if (!ok.ok) throw new Error('expected a plan');
    expect(ok.exteriorBelowMinimum).toBe(false);
    expect(ok.interiorBelowMinimum).toBe(false);
  });

  it('reports the lowest allowed height it used', () => {
    const plan = { ...v1(), wall: { ...v1().wall, toleranceBelowIn: 3 } };
    const r = planFromLogs([log(10, 36.13, 20), log(4, 15, 21)], plan);
    if (!r.ok) throw new Error('expected a plan');
    expect(r.exteriorLowestIn).toBe(81);
  });

  it('ignores deleted logs', () => {
    expect(planFromLogs([log(10, 29, 20), log(4, 15, 21, { deleted: true })], v1()).ok).toBe(false);
  });
});
