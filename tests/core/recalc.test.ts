import { describe, expect, it } from 'vitest';
import { candidatePlans, comparePlan, detectShortfall, supplyableClasses } from '../../src/core/recalc';
import { DEFAULT_SETTINGS as S, seedRecords } from '../../src/core/seed';
import type { PlanVersion } from '../../src/core/types';
import type { Recommendation } from '../../src/core/recommend';
import { log } from '../helpers/records';
import { syntheticTree } from '../helpers/trees';

const v1 = () => seedRecords().find((r) => r.type === 'plan') as PlanVersion;
const rec = (unfillable: string[]): Recommendation => ({ next: [], treesNeeded: unfillable.length ? null : 10, spare: 1, unfillable, yieldPlan: [] });
const asMap = (rows: { lengthFt: number; minCirc: number; quantity: number }[]) =>
  Object.fromEntries(rows.map((r) => [`${r.lengthFt}|${r.minCirc.toFixed(1)}`, r.quantity]));

describe('candidatePlans', () => {
  it('offers 11 courses of 25.2 in when only 25.2 in logs can be supplied', () => {
    const [first] = candidatePlans('exterior', [25.2], v1());
    expect(first.courses).toEqual(Array(11).fill(25.2));
    expect(first.heightIn).toBeCloseTo(88.235, 2);
    expect(first.diffIn).toBeCloseTo(4.235, 2);
    expect(asMap(first.rows)).toEqual({ '16|25.2': 22, '12|25.2': 11, '10|25.2': 33, '8|25.2': 11 });
  });
  it('prefers a uniform plan when smaller classes are also allowed', () => {
    expect(candidatePlans('exterior', [25.2, 18.9, 15.8, 12.6], v1())[0].courses).toEqual(Array(11).fill(25.2));
  });
  it('never upgrades a side to larger logs than it uses now', () => {
    for (const c of candidatePlans('interior', [28.3, 25.2, 18.9, 15.8, 12.6], v1(), 50))
      expect(Math.max(...c.courses)).toBeLessThanOrEqual(18.9);
  });
  it('rejects 10 courses of 25.2 in because they stack below 82 in', () => {
    expect(candidatePlans('exterior', [25.2], v1()).some((c) => c.courses.length === 10)).toBe(false);
  });
  it('never puts a larger course above a smaller one', () => {
    for (const c of candidatePlans('interior', [18.9, 15.8, 12.6], v1(), 50))
      for (let i = 1; i < c.courses.length; i++) expect(c.courses[i]).toBeLessThanOrEqual(c.courses[i - 1]);
  });
  it('keeps every candidate within the height tolerance and excludes the current plan', () => {
    const cands = candidatePlans('exterior', [28.3, 25.2], v1(), 50);
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) {
      expect(c.heightIn).toBeGreaterThanOrEqual(82 - 1e-9);
      expect(c.heightIn).toBeLessThanOrEqual(88.5 + 1e-9);
      expect(c.courses).not.toEqual(v1().exteriorCourses);
    }
  });
});

describe('comparePlan', () => {
  it('counts the extra pieces and keeps already-cut logs counting', () => {
    const cand = candidatePlans('exterior', [25.2], v1())[0];
    const logs = [log(16, 30, 8, { source: 'tree' })];
    const c = comparePlan(v1(), cand, { logs, trees: [], s: S });
    expect(c.deltaPieces).toBe(7);
    expect(c.deltaFeet).toBe(82); // one more course of 2×16 + 12 + 3×10 + 8 ft
    expect(c.logsStillCounting).toBe(8);
    expect(c.logsTotal).toBe(8);
    expect(c.treesNeededBefore).not.toBeNull();
  });
});

describe('detectShortfall', () => {
  it('stays quiet before any tree is measured', () => expect(detectShortfall(rec(['16|28.3']), [], S)).toEqual([]));
  it('flags rows no tree up to the largest measured can supply', () => {
    const [sig] = detectShortfall(rec(['16|28.3']), [syntheticTree()], S);
    expect(sig.kind).toBe('unfillable');
    expect(sig.evidence).toMatch(/16 ft/);
    expect(sig.evidence).toMatch(/28\.3 in around/);
    expect(sig.evidence).not.toMatch(/diameter|across/i);
  });
  it('flags low yield of the largest logs after enough trees', () => {
    const t = () => syntheticTree({ predicted: { readings: [], lengthFt: 34, largeLogs: 3 }, actualLargeLogs: 1 });
    const sigs = detectShortfall(rec([]), [t(), t(), t()], S);
    expect(sigs.map((x) => x.kind)).toEqual(['lowYield']);
    expect(sigs[0].evidence).toMatch(/3 of the 9/);
    expect(sigs[0].evidence).toMatch(/33%/);
  });
  it('needs at least the minimum number of trees for the yield signal', () => {
    const t = () => syntheticTree({ predicted: { readings: [], lengthFt: 34, largeLogs: 3 }, actualLargeLogs: 0 });
    expect(detectShortfall(rec([]), [t(), t()], S)).toEqual([]);
  });
});

describe('supplyableClasses', () => {
  it('drops classes the estimator cannot fill', () =>
    expect(supplyableClasses([], rec(['16|28.3']), [28.3, 25.2, 18.9, 15.8, 12.6])).toEqual([25.2, 18.9, 15.8, 12.6]));
  it('keeps every class when nothing is unfillable', () =>
    expect(supplyableClasses([], rec([]), [28.3, 25.2])).toEqual([28.3, 25.2]));
});
