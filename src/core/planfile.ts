import { isValidRecord, SyncError } from './sync';
import type { PlanVersion } from './types';

export interface PlanFile {
  format: 'treetracker-plan';
  version: 1;
  exportedAt: number;
  plan: PlanVersion;
}

export function planName(plan: PlanVersion, number: number): string {
  const n = plan.name?.trim();
  if (n) return n;
  return plan.id === 'plan-v1' ? 'Starting plan' : `Plan ${number}`;
}

export function buildPlanFile(plan: PlanVersion, now: number): PlanFile {
  return { format: 'treetracker-plan', version: 1, exportedAt: now, plan };
}

export function planFileName(name: string, now: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan';
  const d = new Date(now);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `treetracker-plan-${slug}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export function parsePlanFile(text: string): PlanVersion {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SyncError('This file could not be read. Choose a TreeTracker plan file.');
  }
  const f = data as Partial<PlanFile>;
  if ((data as { format?: string } | null)?.format === 'treetracker-sync') throw new SyncError('This is a sync file, not a plan file. Import it on the Sync screen.');
  if (!f || f.format !== 'treetracker-plan') throw new SyncError('This is not a TreeTracker plan file.');
  if (f.version !== 1) throw new SyncError('This plan file comes from a newer version of TreeTracker. Update the app on this phone first.');
  if (!isValidRecord(f.plan) || f.plan!.type !== 'plan') throw new SyncError('This plan file is damaged. Nothing was imported.');
  return f.plan as PlanVersion;
}

/** Stable text for comparing objects whatever their key order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** Same courses, wall measurements and row minimums: the same plan, whatever its name or id. */
export function samePlan(a: PlanVersion, b: PlanVersion): boolean {
  const key = (p: PlanVersion) => canonical({ e: p.exteriorCourses, i: p.interiorCourses, w: p.wall, m: p.rowMinimums ?? {} });
  return key(a) === key(b);
}
