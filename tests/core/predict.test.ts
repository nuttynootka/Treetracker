import { describe, expect, it } from 'vitest';
import { learnedMaxLengthFt, predictProfile, priorProfile } from '../../src/core/predict';
import { circAt } from '../../src/core/profile';
import { DEFAULT_SETTINGS as S } from '../../src/core/seed';
import { syntheticTree, tree } from '../helpers/trees';

describe('priorProfile', () => {
  const p = priorProfile(37.7, S);
  it('puts the butt 3 ft of taper below waist height', () => expect(p.points[0].circ).toBeCloseTo(39.47, 2));
  it('tapers 0.59 in per foot', () => expect(circAt(p, 16)).toBeCloseTo(30.03, 2));
  it('runs until the top circumference', () => {
    expect(p.lengthFt).toBeCloseTo(45.54, 2);
    expect(p.points.at(-1)!.circ).toBe(12.6);
  });
});

describe('predictProfile', () => {
  it('equals the prior when no trees are measured', () => expect(predictProfile(37.7, [], S)).toEqual(priorProfile(37.7, S)));

  it('follows the measured trees once 5 are measured', () => {
    const trees = [1, 2, 3, 4, 5].map(() => syntheticTree());
    const p = predictProfile(38.5, trees, S);
    for (const [x, c] of [[0, 42.4], [6, 34.6], [12, 30.2], [18, 26.4], [24, 22.0], [30, 17.6]])
      expect(Math.abs(circAt(p, x) - c)).toBeLessThan(0.2);
    expect(p.lengthFt).toBeCloseTo(34, 1);
  });

  it('never increases going up', () => {
    const trees = [tree(30, 40, [36, 37, 30, 20]), syntheticTree()];
    const p = predictProfile(35, trees, S);
    for (let i = 1; i < p.points.length; i++) expect(p.points[i].circ).toBeLessThanOrEqual(p.points[i - 1].circ);
  });

  it('caps the length at 110% of the longest measured tree', () => {
    const trees = [tree(20, 40, [30, 20, 14])];
    expect(predictProfile(37.7, trees, S).lengthFt).toBeLessThanOrEqual(22 + 1e-9);
  });

  it('ignores deleted trees', () => {
    expect(predictProfile(37.7, [syntheticTree({ deleted: true })], S)).toEqual(priorProfile(37.7, S));
  });
});

describe('learnedMaxLengthFt', () => {
  it('is null with no trees and 1.1 x the longest otherwise', () => {
    expect(learnedMaxLengthFt([])).toBeNull();
    expect(learnedMaxLengthFt([tree(20, 40, [30, 20, 14]), syntheticTree()])).toBeCloseTo(37.4, 9);
  });
});
