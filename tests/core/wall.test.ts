import { describe, expect, it } from 'vitest';
import { generateRows, pieceLengthIn, stackHeight } from '../../src/core/wall';
import { DEFAULT_WALL, PLAN_V1_COURSES, seedRecords } from '../../src/core/seed';
import { rowKey } from '../../src/core/types';

const asMap = (rows: { lengthFt: number; minCirc: number; quantity: number }[]) =>
  Object.fromEntries(rows.map((r) => [rowKey(r.lengthFt, r.minCirc), r.quantity]));
const rep = (c: number, n: number) => Array<number>(n).fill(c);
const pieces = (rows: { quantity: number }[]) => rows.reduce((s, r) => s + r.quantity, 0);

describe('pieceLengthIn', () => {
  it('subtracts the post width and adds two tenons', () => {
    expect(pieceLengthIn(120, DEFAULT_WALL)).toBe(113);
    expect(pieceLengthIn(192, DEFAULT_WALL)).toBe(185);
    expect(pieceLengthIn(144, DEFAULT_WALL)).toBe(137);
    expect(pieceLengthIn(96, DEFAULT_WALL)).toBe(89);
  });
});

describe('generateRows', () => {
  it('reproduces the starting 17-row, 138-log list from plan version 1', () => {
    const rows = generateRows(PLAN_V1_COURSES.exterior, PLAN_V1_COURSES.interior, DEFAULT_WALL);
    expect(asMap(rows)).toEqual({
      '16|28.3': 8, '16|25.2': 12, '12|28.3': 4, '12|25.2': 6, '10|28.3': 12, '10|25.2': 18, '8|28.3': 4, '8|25.2': 6,
      '6|18.9': 4, '6|15.8': 8, '6|12.6': 5, '5|18.9': 4, '5|15.8': 8, '5|12.6': 5, '4|18.9': 8, '4|15.8': 16, '4|12.6': 10,
    });
    expect(rows).toHaveLength(17);
    expect(pieces(rows)).toBe(138);
  });

  it('gives the addendum rows for 11 exterior courses of 25.2 in', () => {
    expect(asMap(generateRows(rep(25.2, 11), [], DEFAULT_WALL))).toEqual({ '16|25.2': 22, '12|25.2': 11, '10|25.2': 33, '8|25.2': 11 });
  });

  it('gives 70 pieces for 10 courses of 25.2 in and 63 for 9 of 28.3 in', () => {
    expect(pieces(generateRows(rep(25.2, 10), [], DEFAULT_WALL))).toBe(70);
    expect(pieces(generateRows(rep(28.3, 9), [], DEFAULT_WALL))).toBe(63);
  });

  it('sorts rows longest first, then largest around first', () => {
    const rows = generateRows(PLAN_V1_COURSES.exterior, PLAN_V1_COURSES.interior, DEFAULT_WALL);
    expect(rows.slice(0, 3).map((r) => rowKey(r.lengthFt, r.minCirc))).toEqual(['16|28.3', '16|25.2', '12|28.3']);
  });
});

describe('stackHeight', () => {
  it('uses circumference divided by pi for each course', () => {
    expect(stackHeight(rep(25.2, 11), DEFAULT_WALL)).toBeCloseTo(88.235, 2);
    expect(stackHeight(PLAN_V1_COURSES.exterior, DEFAULT_WALL)).toBeCloseTo(84.161, 2);
  });
  it('uses a per-class course height when one is set', () => {
    const w = { ...DEFAULT_WALL, courseHeightIn: { '25.2': 8 } };
    expect(stackHeight(rep(25.2, 11), w)).toBe(88);
  });
});

describe('seedRecords', () => {
  it('is deterministic so two phones seed identical records', () => {
    expect(seedRecords()).toEqual(seedRecords());
  });
  it('contains settings, plan v1, its 17 rows and the active pointer', () => {
    const recs = seedRecords();
    expect(recs.filter((r) => r.type === 'need')).toHaveLength(17);
    expect(recs.find((r) => r.id === 'plan-v1')?.type).toBe('plan');
    expect(recs.find((r) => r.id === 'active-plan')).toMatchObject({ type: 'active', planVersionId: 'plan-v1' });
    expect(recs.find((r) => r.id === 'settings')).toMatchObject({ type: 'settings', kerfIn: 0.375, maxWaistCirc: 37.7 });
  });
});
