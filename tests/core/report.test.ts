import { describe, expect, it } from 'vitest';
import { reportCsv, reportText } from '../../src/core/report';
import type { ReportInput } from '../../src/core/report';
import { syntheticTree } from '../helpers/trees';

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  rows: [
    { lengthFt: 16, minCirc: 28.3, needed: 8, have: 3, toCut: 5 },
    { lengthFt: 4, minCirc: 12.6, needed: 10, have: 10, toCut: 0 },
  ],
  logs: [
    { lengthFt: 16, smallCirc: 30.1, quantity: 3, source: 'tree' },
    { lengthFt: 4, smallCirc: 13, quantity: 10, source: 'manual' },
  ],
  extras: 1,
  rec: { next: [37.7, 34.6, 34.6], treesNeeded: 40, spare: 4, unfillable: [], yieldPlan: [] },
  trees: [syntheticTree({ predicted: { readings: [35, 31, 27, 23, 18], lengthFt: 34, largeLogs: 1 } })],
  generatedAt: Date.UTC(2026, 9, 20),
  planVersion: 1,
  ...over,
});

describe('reportText', () => {
  const text = reportText(input());
  it('has every section in order', () => {
    const heads = ['TreeTracker report', 'Logs we have', 'Logs still needed', 'Next trees to cut', 'Trees still needed', 'Prediction error'];
    const at = heads.map((h) => text.indexOf(h));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('shows each row with its totals', () => {
    expect(text).toMatch(/16 ft · 28\.3 in around.*need 8.*have 3.*to cut 5/);
    expect(text).toContain('Plan version 1');
  });
  it('shows next trees and the estimate', () => {
    expect(text).toContain('37.7 in around at waist height');
    expect(text).toContain('About 40 (+4 spare)');
  });
  it('explains when the list cannot be finished', () => {
    const t = reportText(input({ rec: { next: [], treesNeeded: null, spare: 0, unfillable: ['16|28.3'], yieldPlan: [] } }));
    expect(t).toContain('Cannot be finished with the trees measured so far: 16 ft logs 28.3 in around');
  });
  it('never mentions a diameter or a tree length as advice', () => {
    expect(text).not.toMatch(/diameter|across|tree length/i);
  });
  it('reports the average prediction error', () => expect(text).toMatch(/Average error \d+\.\d in/));
});

describe('reportCsv', () => {
  it('has a header and one line per row and per log group', () => {
    const lines = reportCsv(input()).trim().split('\n');
    expect(lines[0]).toBe('section,length_ft,circumference_in,needed,have,still_to_cut,quantity,source');
    expect(lines).toHaveLength(1 + 2 + 2);
    expect(lines[1]).toBe('needed,16,28.3,8,3,5,,');
    expect(lines[3]).toBe('have,16,30.1,,,,3,tree');
  });
});
