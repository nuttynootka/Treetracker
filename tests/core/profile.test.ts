import { describe, expect, it } from 'vitest';
import { buildProfile, circAt, readingStations, validateTree, waistCirc } from '../../src/core/profile';

const synthetic = () => buildProfile(34, 42.4, [34.6, 30.2, 26.4, 22.0, 17.6], 12.6);

describe('readingStations', () => {
  it('lists every 6 ft step below the length', () => expect(readingStations(34)).toEqual([6, 12, 18, 24, 30]));
  it('excludes a station equal to the length', () => expect(readingStations(36)).toEqual([6, 12, 18, 24, 30]));
  it('has no stations for a short tree', () => expect(readingStations(5)).toEqual([]));
});

describe('buildProfile and circAt', () => {
  it('ends with the top circumference at the entered length', () => {
    const p = synthetic();
    expect(p.points).toHaveLength(7);
    expect(p.points[6]).toEqual({ xFt: 34, circ: 12.6 });
  });
  it('interpolates linearly', () => {
    const p = synthetic();
    expect(circAt(p, 3)).toBeCloseTo(38.5, 2);
    expect(circAt(p, 33)).toBeCloseTo(13.85, 2);
  });
});

describe('waistCirc', () => {
  it('reads the profile at waist height minus stump height', () =>
    expect(waistCirc(synthetic(), { waistHeightFt: 4, stumpHeightFt: 1 })).toBeCloseTo(38.5, 2));
  it('uses the butt circumference when that position is not above the butt', () =>
    expect(waistCirc(synthetic(), { waistHeightFt: 4, stumpHeightFt: 4 })).toBe(42.4));
});

describe('validateTree', () => {
  it('errors on a missing length', () => expect(validateTree(null, 40, [], 12.6).errors.length).toBeGreaterThan(0));
  it('warns when a reading increases going up the tree', () =>
    expect(validateTree(20, 34, [30, 32, 20], 12.6).warnings.join(' ')).toMatch(/increases going up/));
  it('warns when a circumference is outside 5 to 80 in', () =>
    expect(validateTree(20, 90, [30, 20, 15], 12.6).warnings.join(' ')).toMatch(/5.*80/));
  it('warns when the length is outside 4 to 120 ft', () =>
    expect(validateTree(130, 40, [], 12.6).warnings.join(' ')).toMatch(/4.*120/));
  it('warns when a reading is below the top circumference before the top', () =>
    expect(validateTree(20, 40, [30, 11, 10], 12.6).warnings.join(' ')).toMatch(/below 12.6/));
  it('has no errors or warnings for the synthetic tree', () =>
    expect(validateTree(34, 42.4, [34.6, 30.2, 26.4, 22.0, 17.6], 12.6)).toEqual({ errors: [], warnings: [] }));
  it('errors when a reading is missing', () =>
    expect(validateTree(34, 42.4, [34.6, null, 26.4, 22.0, 17.6], 12.6).errors.length).toBeGreaterThan(0));
});
