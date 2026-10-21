import { describe, expect, it } from 'vitest';
import { buildPlanFile, parsePlanFile, planFileName, planName, samePlan } from '../../src/core/planfile';
import { buildExport, isValidRecord, SyncError } from '../../src/core/sync';
import { seedRecords } from '../../src/core/seed';
import type { ActivePlan, PlanVersion } from '../../src/core/types';

const v1 = () => seedRecords().find((r) => r.type === 'plan') as PlanVersion;

describe('plan names', () => {
  it('names the seeded plan "Starting plan"', () => expect(v1().name).toBe('Starting plan'));
  it('falls back for plans without a name', () => {
    expect(planName({ ...v1(), name: undefined })).toBe('Starting plan');
    expect(planName({ ...v1(), id: 'plan-x', name: '  ', version: 4 })).toBe('Plan 4');
    expect(planName({ ...v1(), name: 'Big logs' })).toBe('Big logs');
  });
});

describe('plan files', () => {
  it('round-trips a plan', () => {
    const p = { ...v1(), name: 'From my logs', rowMinimums: { exterior: 18.9, interior: 12.6 } };
    expect(parsePlanFile(JSON.stringify(buildPlanFile(p, 5)))).toEqual(p);
  });
  it('names the file after the plan and date', () =>
    expect(planFileName('From my logs!', Date.UTC(2026, 9, 21, 9, 0))).toMatch(/^treetracker-plan-from-my-logs-2026-10-21\.json$/));
  it('explains when given a sync file instead', () =>
    expect(() => parsePlanFile(JSON.stringify(buildExport([], { id: 'a', name: 'A' }, 1)))).toThrow(/sync file.*Sync screen/));
  it('refuses a plan with damaged wall measurements or no courses', () => {
    const bad = (plan: object) => JSON.stringify({ ...buildPlanFile(v1(), 1), plan: { ...v1(), ...plan } });
    expect(() => parsePlanFile(bad({ wall: {} }))).toThrow(/damaged/);
    expect(() => parsePlanFile(bad({ wall: { ...v1().wall, exteriorWalls: [{ name: 'W1' }] } }))).toThrow(/damaged/);
    expect(() => parsePlanFile(bad({ exteriorCourses: [] }))).toThrow(/damaged/);
    expect(() => parsePlanFile(bad({ rowMinimums: { exterior: -1 } }))).toThrow(/damaged/);
  });
  it('refuses text that is not a plan file', () => {
    expect(() => parsePlanFile('{')).toThrow(SyncError);
    expect(() => parsePlanFile('{"format":"treetracker-plan","version":1,"plan":{"id":"p"}}')).toThrow(/damaged/);
    expect(() => parsePlanFile(JSON.stringify({ ...buildPlanFile(v1(), 1), version: 2 }))).toThrow(/newer/);
  });
});

describe('samePlan', () => {
  it('matches plans with the same courses, walls and minimums, whatever the name or id', () => {
    const a = v1();
    expect(samePlan(a, { ...a, id: 'other', name: 'Copy', version: 7 })).toBe(true);
    expect(samePlan(a, { ...a, exteriorCourses: [...a.exteriorCourses, 25.2] })).toBe(false);
    expect(samePlan(a, { ...a, rowMinimums: { exterior: 18.9 } })).toBe(false);
    expect(samePlan(a, { ...a, wall: { ...a.wall, courseHeightIn: { '25.2': 8 } } })).toBe(false);
  });
});

describe('record checks accept the new fields', () => {
  it('accepts a named, archived plan with row minimums and an active pointer with a previous plan', () => {
    expect(isValidRecord({ ...v1(), name: 'x', archived: true, rowMinimums: { exterior: 18.9 } })).toBe(true);
    const active = seedRecords().find((r) => r.type === 'active') as ActivePlan;
    expect(isValidRecord({ ...active, previousPlanId: 'plan-v1' })).toBe(true);
    expect(isValidRecord({ ...v1(), rowMinimums: { exterior: 'big' } })).toBe(false);
  });
});
