import { describe, expect, it } from 'vitest';
import { recommend } from '../../src/core/recommend';
import { DEFAULT_SETTINGS } from '../../src/core/seed';
import { v1PlannerRows } from '../helpers/rows';

// Model benchmark from the build brief: starting list, prior taper only, perfect cutting,
// the size limit given at the butt cut face (3 ft below waist height).
function run(cutFace: number, taper = 0.59) {
  const s = { ...DEFAULT_SETTINGS, priorTaperPerFt: taper };
  const r = recommend(v1PlannerRows(), [], s, { maxWaist: cutFace - 3 * taper });
  const mix: Record<string, number> = {};
  for (const y of r.yieldPlan) {
    const k = (y.waist + 3 * taper).toFixed(1);
    mix[k] = (mix[k] ?? 0) + 1;
  }
  console.log(`benchmark cut face ${cutFace} taper ${taper}: ${r.treesNeeded} trees, at cut face`, mix);
  return r;
}

describe('benchmark', { timeout: 120_000 }, () => {
  it('needs about 40 trees when the largest is 39.6 in at the cut face', () => {
    const n = run(39.6).treesNeeded;
    expect(n).not.toBeNull();
    expect(n!).toBeGreaterThanOrEqual(34);
    expect(n!).toBeLessThanOrEqual(46);
  });
  it('needs about 40 trees when the largest is 39.47 in at the cut face', () => {
    const n = run(39.47).treesNeeded;
    expect(n!).toBeGreaterThanOrEqual(34);
    expect(n!).toBeLessThanOrEqual(46);
  });
  // At exactly 37.7 in the 16 ft log needing 28.3 in ends 16.17 ft up at 28.16 in, so it cannot be cut.
  // 37.85 in is the smallest cut face (2 in butt trim, 0.59 in/ft) where that log becomes possible.
  it('cannot cut the 16 ft 28.3 in logs when the largest is exactly 37.7 in at the cut face', () =>
    expect(run(37.7).unfillable).toEqual(['16|28.3']));
  it('needs about 45 trees when the largest is just big enough (37.85 in) at the cut face', () => {
    const n = run(37.85).treesNeeded;
    expect(n!).toBeGreaterThanOrEqual(38);
    expect(n!).toBeLessThanOrEqual(52);
  });
  it('cannot be finished when the largest is 34.6 in at the cut face', () => expect(run(34.6).treesNeeded).toBeNull());
  it('cannot be finished with a 0.79 in per foot taper', () => expect(run(39.6, 0.79).treesNeeded).toBeNull());
});
