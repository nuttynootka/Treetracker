import { planTree, planYield, rowWeight } from './planner';
import { predictProfile } from './predict';
import { round1 } from './num';
import type { CutPlan, PlannerRow, Profile, SettingsValues, Tree } from './types';

export interface Recommendation {
  next: number[];
  treesNeeded: number | null;
  spare: number;
  unfillable: string[];
  yieldPlan: { waist: number; rows: Map<string, number> }[];
}

const MIN_WAIST = 22;

export function candidateWaists(maxWaist: number): number[] {
  const out: number[] = [];
  for (let w = MIN_WAIST; w <= Math.floor(maxWaist); w++) out.push(w);
  if (!Number.isInteger(maxWaist) && maxWaist > MIN_WAIST) out.push(maxWaist);
  return out;
}

function planValue(plan: CutPlan, rows: PlannerRow[]): number {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return plan.cuts.reduce((v, c) => v + rowWeight(byKey.get(c.rowKey)!), 0);
}

/**
 * Greedy simulation: repeatedly pick the waist size whose predicted tree gives the most value per
 * waist circumference squared, deduct its yield, and continue until every row is met.
 */
export function recommend(
  rows: PlannerRow[],
  trees: Tree[],
  s: SettingsValues,
  opts: { maxWaist?: number; maxTrees?: number } = {},
): Recommendation {
  const candidates = candidateWaists(opts.maxWaist ?? s.maxWaistCirc);
  const profiles = new Map<number, Profile>(candidates.map((c) => [c, predictProfile(c, trees, s)]));
  const maxTrees = opts.maxTrees ?? 300;
  let remaining = rows.filter((r) => r.remaining > 0).map((r) => ({ ...r }));
  const yieldPlan: Recommendation['yieldPlan'] = [];

  while (remaining.length && yieldPlan.length < maxTrees) {
    let best: { waist: number; score: number; plan: CutPlan } | null = null;
    for (const c of candidates) {
      const plan = planTree(profiles.get(c)!, remaining, s);
      if (!plan.cuts.length) continue;
      const score = planValue(plan, remaining) / (c * c);
      if (!best || score > best.score + 1e-12) best = { waist: c, score, plan };
    }
    if (!best) break;
    const y = planYield(best.plan);
    yieldPlan.push({ waist: best.waist, rows: y });
    remaining = remaining
      .map((r) => ({ ...r, remaining: r.remaining - (y.get(r.key) ?? 0) }))
      .filter((r) => r.remaining > 0);
  }

  const done = remaining.length === 0;
  const treesNeeded = done ? yieldPlan.length : null;
  return {
    next: yieldPlan.slice(0, 3).map((y) => round1(y.waist)),
    treesNeeded,
    spare: treesNeeded === null ? 0 : Math.ceil(treesNeeded * s.spareFraction),
    unfillable: remaining.map((r) => r.key),
    yieldPlan,
  };
}

/** Pieces in the largest circumference class among the given rows. */
export function largestClassCount(plan: CutPlan, rows: PlannerRow[]): number {
  if (!rows.length) return 0;
  const top = Math.max(...rows.map((r) => r.minCirc));
  const keys = new Set(rows.filter((r) => r.minCirc === top).map((r) => r.key));
  return plan.cuts.filter((c) => keys.has(c.rowKey)).length;
}
