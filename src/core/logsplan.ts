import { round1 } from './num';
import { courseHeight, generateRows } from './wall';
import type { GeneratedRow } from './wall';
import type { LogCut, PlanVersion, RowMinimums } from './types';

export const LOGS_PLAN_MIN_LOGS = 41; // "more than 40 logs"
const SAMPLE = 20;
/** Owner's minimums for a plan built from logs: 6 in and 4 in diameter, as circumference rounded up to 0.1 in. */
export const LOGS_PLAN_MINIMUMS: Required<RowMinimums> = { exterior: 18.9, interior: 12.6 };

export type LogsPlan =
  | { ok: false; count: number }
  | {
      ok: true;
      count: number;
      exteriorAvg: number;
      interiorAvg: number;
      exteriorCourses: number[];
      interiorCourses: number[];
      exteriorHeightIn: number;
      interiorHeightIn: number;
      exteriorAdded: boolean;
      interiorAdded: boolean;
      rowMinimums: Required<RowMinimums>;
      rows: GeneratedRow[];
    };

/** Courses of one size: the count whose height is closest to the target, plus one if that falls below the allowed minimum. */
function courseCount(avg: number, target: number, lowest: number, plan: PlanVersion) {
  const h = courseHeight(avg, plan.wall);
  let n = Math.max(1, Math.round(target / h));
  const added = n * h < lowest - 1e-9;
  if (added) n++;
  return { n, height: n * h, added };
}

/**
 * Alternative plan from the logs cut so far: exterior courses sized to the average of the 20 largest logs,
 * interior to the average of the 20 smallest, keeping the current plan's wall layout.
 */
export function planFromLogs(logs: LogCut[], plan: PlanVersion): LogsPlan {
  const sizes = logs.filter((l) => !l.deleted).flatMap((l) => Array<number>(Math.max(0, l.quantity)).fill(l.smallCirc));
  if (sizes.length < LOGS_PLAN_MIN_LOGS) return { ok: false, count: sizes.length };
  sizes.sort((a, b) => b - a);
  const mean = (xs: number[]) => round1(xs.reduce((a, b) => a + b, 0) / xs.length);
  const exteriorAvg = mean(sizes.slice(0, SAMPLE));
  const interiorAvg = mean(sizes.slice(-SAMPLE));
  const w = plan.wall;
  const ext = courseCount(exteriorAvg, w.exteriorHeightIn, w.exteriorHeightIn - w.toleranceBelowIn, plan);
  const int = courseCount(interiorAvg, w.interiorHeightIn, w.interiorHeightIn - w.toleranceBelowIn, plan);
  const exteriorCourses = Array<number>(ext.n).fill(exteriorAvg);
  const interiorCourses = Array<number>(int.n).fill(interiorAvg);
  return {
    ok: true,
    count: sizes.length,
    exteriorAvg,
    interiorAvg,
    exteriorCourses,
    interiorCourses,
    exteriorHeightIn: ext.height,
    interiorHeightIn: int.height,
    exteriorAdded: ext.added,
    interiorAdded: int.added,
    rowMinimums: { ...LOGS_PLAN_MINIMUMS },
    rows: generateRows(exteriorCourses, interiorCourses, w, LOGS_PLAN_MINIMUMS),
  };
}
