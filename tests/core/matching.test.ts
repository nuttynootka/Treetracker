import { describe, expect, it } from 'vitest';
import { matchLogs, remainingPlannerRows } from '../../src/core/matching';
import { log, need } from '../helpers/records';

describe('matchLogs', () => {
  it('lets a larger log fill a smaller-minimum row of the same length', () => {
    const r = need(16, 28.3, 1);
    expect(matchLogs([r], [log(16, 30)]).have.get(r.id)).toBe(1);
  });
  it('does not let a shorter log fill a longer row', () => {
    const r = need(16, 28.3, 1);
    expect(matchLogs([r], [log(15, 30)]).have.get(r.id) ?? 0).toBe(0);
  });
  it('does not let a thinner log fill a row, but lets it fill a thinner row', () => {
    const big = need(10, 28.3, 1);
    const small = need(10, 25.2, 1);
    const m = matchLogs([big, small], [log(10, 28.0)]);
    expect(m.have.get(big.id) ?? 0).toBe(0);
    expect(m.have.get(small.id)).toBe(1);
  });
  it('gives each row the smallest log that fits so big logs are not wasted', () => {
    const big = need(10, 28.3, 1);
    const small = need(10, 25.2, 1);
    const m = matchLogs([small, big], [log(10, 29), log(10, 26)]);
    expect(m.have.get(big.id)).toBe(1);
    expect(m.have.get(small.id)).toBe(1);
    expect(m.extras).toEqual([]);
  });
  it('reports logs beyond what a row needs as extras', () => {
    const r = need(8, 25.2, 2);
    const l = log(8, 26, 3);
    const m = matchLogs([r], [l]);
    expect(m.have.get(r.id)).toBe(2);
    expect(m.extras).toEqual([{ logId: l.id, count: 1 }]);
  });
  it('ignores deleted logs and deleted rows', () => {
    const r = need(8, 25.2, 1);
    const gone = need(8, 25.2, 1, { deleted: true });
    const m = matchLogs([r, gone], [log(8, 26, 1, { deleted: true })]);
    expect(m.have.get(r.id) ?? 0).toBe(0);
    expect(m.have.has(gone.id)).toBe(false);
  });
});

describe('remainingPlannerRows', () => {
  it('never goes negative and drops finished rows', () => {
    const a = need(8, 25.2, 2);
    const b = need(16, 28.3, 3);
    const rows = remainingPlannerRows([a, b], new Map([[a.id, 5], [b.id, 1]]));
    expect(rows).toEqual([{ key: '16|28.3', lengthFt: 16, minCirc: 28.3, remaining: 2, quantity: 3 }]);
  });
  it('merges rows with the same size', () => {
    const a = need(8, 25.2, 2);
    const b = need(8, 25.2, 3);
    expect(remainingPlannerRows([a, b], new Map())).toEqual([{ key: '8|25.2', lengthFt: 8, minCirc: 25.2, remaining: 5, quantity: 5 }]);
  });
});
