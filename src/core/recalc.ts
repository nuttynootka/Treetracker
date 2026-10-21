import { matchLogs, remainingPlannerRows } from './matching';
import { recommend } from './recommend';
import { usableTrees } from './predict';
import type { Recommendation } from './recommend';
import { courseHeight, generateRows, stackHeight } from './wall';
import type { GeneratedRow } from './wall';
import type { LogCut, NeedRow, PlanVersion, RowMinimums, SettingsValues, Tree } from './types';
import type { LogsPlan } from './logsplan';

export interface ShortfallSignal {
  kind: 'unfillable' | 'lowYield';
  evidence: string;
}

const describeKey = (key: string) => {
  const [len, circ] = key.split('|');
  return `${len} ft logs ${circ} in around`;
};

/** Signals that the trees cannot supply the current plan. `rec` must be computed with the largest waist actually entered. */
export function detectShortfall(rec: Recommendation | null, trees: Tree[], s: SettingsValues): ShortfallSignal[] {
  const live = usableTrees(trees);
  if (!live.length) return [];
  const out: ShortfallSignal[] = [];
  if (rec && rec.unfillable.length) {
    const largest = Math.max(...live.map((t) => t.waistCirc)).toFixed(1);
    out.push({
      kind: 'unfillable',
      evidence: `No tree up to ${largest} in around at waist height (your largest so far) can supply: ${rec.unfillable.map(describeKey).join('; ')}.`,
    });
  }
  const predicted = live.filter((t) => t.predicted);
  if (predicted.length >= s.shortfallMinTrees) {
    const expected = predicted.reduce((a, t) => a + t.predicted!.largeLogs, 0);
    const got = predicted.reduce((a, t) => a + t.actualLargeLogs, 0);
    if (expected > 0 && got / expected < s.shortfallYieldRatio) {
      out.push({
        kind: 'lowYield',
        evidence: `Your ${predicted.length} trees gave ${got} of the ${expected} largest logs the model expected (${Math.round((100 * got) / expected)}%).`,
      });
    }
  }
  return out;
}

/** Circumference classes the trees can still supply: those with no unfillable row. */
export function supplyableClasses(_logs: LogCut[], rec: Recommendation | null, allClasses: number[]): number[] {
  const blocked = new Set((rec?.unfillable ?? []).map((k) => Number(k.split('|')[1]).toFixed(1)));
  return [...allClasses].sort((a, b) => b - a).filter((c) => !blocked.has(c.toFixed(1)));
}

export interface CandidatePlan {
  side: 'exterior' | 'interior';
  courses: number[];
  heightIn: number;
  diffIn: number;
  rows: GeneratedRow[];
}

const sideRows = (side: 'exterior' | 'interior', courses: number[], plan: PlanVersion, minimums: RowMinimums = {}) =>
  side === 'exterior' ? generateRows(courses, [], plan.wall, minimums) : generateRows([], courses, plan.wall, minimums);
const pieceCount = (rows: GeneratedRow[]) => rows.reduce((a, r) => a + r.quantity, 0);
const feetCount = (rows: GeneratedRow[]) => rows.reduce((a, r) => a + r.quantity * r.lengthFt, 0);

/**
 * Course plans using only the allowed classes, largest at the bottom, stacking within the height
 * tolerance. A side never moves to larger logs than it uses now, since the point is a shortage.
 * Ranked by fewest pieces, then fewest linear feet, then fewest different sizes, then closest to the target height.
 */
export function candidatePlans(side: 'exterior' | 'interior', allowed: number[], plan: PlanVersion, limit = 3): CandidatePlan[] {
  const w = plan.wall;
  const target = side === 'exterior' ? w.exteriorHeightIn : w.interiorHeightIn;
  const lo = target - w.toleranceBelowIn - 1e-9;
  const hi = target + w.toleranceAboveIn + 1e-9;
  const current = side === 'exterior' ? plan.exteriorCourses : plan.interiorCourses;
  const largest = current.length ? Math.max(...current) : Infinity;
  const classes = [...new Set(allowed.map((c) => Number(c.toFixed(1))))].filter((c) => c <= largest + 1e-9).sort((a, b) => b - a);
  const out: CandidatePlan[] = [];
  const counts = classes.map(() => 0);

  const visit = (i: number, height: number) => {
    if (i === classes.length) {
      if (height < lo) return;
      const courses = classes.flatMap((c, k) => Array<number>(counts[k]).fill(c));
      if (!courses.length || (courses.length === current.length && courses.every((c, k) => c === current[k]))) return;
      out.push({ side, courses, heightIn: stackHeight(courses, w), diffIn: stackHeight(courses, w) - target, rows: sideRows(side, courses, plan) });
      return;
    }
    const h = courseHeight(classes[i], w);
    if (!(h > 0)) {
      // A class with no height cannot be stacked; skip it rather than loop forever.
      counts[i] = 0;
      visit(i + 1, height);
      return;
    }
    for (let n = 0; height + n * h <= hi; n++) {
      counts[i] = n;
      visit(i + 1, height + n * h);
    }
    counts[i] = 0;
  };
  visit(0, 0);
  return out
    .sort(
      (a, b) =>
        pieceCount(a.rows) - pieceCount(b.rows) ||
        feetCount(a.rows) - feetCount(b.rows) ||
        new Set(a.courses).size - new Set(b.courses).size ||
        Math.abs(a.diffIn) - Math.abs(b.diffIn),
    )
    .slice(0, limit);
}

const toNeedRows = (rows: GeneratedRow[]): NeedRow[] =>
  rows.map((r, i) => ({ id: `cmp-${i}`, type: 'need', updatedAt: '', deleted: false, deviceId: '', ...r, planVersionId: null, manuallyEdited: false }));

function treesNeeded(rows: GeneratedRow[], logs: LogCut[], trees: Tree[], s: SettingsValues) {
  const need = toNeedRows(rows);
  const m = matchLogs(need, logs);
  return { rec: recommend(remainingPlannerRows(need, m.have), trees, s), have: [...m.have.values()].reduce((a, b) => a + b, 0) };
}

interface CompareContext {
  logs: LogCut[];
  trees: Tree[];
  s: SettingsValues;
  /** The active needs rows, including hand edits. */
  rows: NeedRow[];
}

/** Rows added by hand (no plan version) carry over to any new plan; generated rows are rebuilt. */
const handAdded = (rows: NeedRow[]): GeneratedRow[] =>
  rows.filter((r) => !r.deleted && r.planVersionId === null).map((r) => ({ lengthFt: r.lengthFt, minCirc: r.minCirc, quantity: r.quantity }));

function compareRows(after: GeneratedRow[], ctx: CompareContext) {
  const before: GeneratedRow[] = ctx.rows.filter((r) => !r.deleted).map((r) => ({ lengthFt: r.lengthFt, minCirc: r.minCirc, quantity: r.quantity }));
  const b = treesNeeded(before, ctx.logs, ctx.trees, ctx.s);
  const a = treesNeeded(after, ctx.logs, ctx.trees, ctx.s);
  return {
    deltaPieces: pieceCount(after) - pieceCount(before),
    deltaFeet: feetCount(after) - feetCount(before),
    treesNeededBefore: b.rec.treesNeeded,
    treesNeededAfter: a.rec.treesNeeded,
    logsStillCounting: a.have,
    logsTotal: ctx.logs.filter((l) => !l.deleted).reduce((t, l) => t + l.quantity, 0),
  };
}

/** Compare a one-side candidate with the rows in use now. */
export function comparePlan(current: PlanVersion, cand: CandidatePlan, ctx: CompareContext) {
  const other = cand.side === 'exterior' ? 'interior' : 'exterior';
  const keep: RowMinimums = current.rowMinimums?.[other] !== undefined ? { [other]: current.rowMinimums[other] } : {};
  const after = [
    ...cand.rows,
    ...sideRows(other, other === 'interior' ? current.interiorCourses : current.exteriorCourses, current, keep),
    ...handAdded(ctx.rows),
  ];
  return compareRows(after, ctx);
}

/** Compare the plan built from logs with the rows in use now. */
export function comparePlanFromLogs(lp: Extract<LogsPlan, { ok: true }>, ctx: CompareContext) {
  return compareRows([...lp.rows, ...handAdded(ctx.rows)], ctx);
}
