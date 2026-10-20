import { rowKey } from './types';
import type { Id, LogCut, NeedRow, PlannerRow } from './types';

export interface Match {
  have: Map<Id, number>;
  extras: { logId: Id; count: number }[];
}

/**
 * Greedy assignment of cut logs to need rows. Rows go longest first, then largest around first;
 * each row takes the smallest fitting log (shortest, then thinnest) until full.
 */
export function matchLogs(rows: NeedRow[], logs: LogCut[]): Match {
  const units = logs
    .filter((l) => !l.deleted)
    .flatMap((l) => Array.from({ length: Math.max(0, l.quantity) }, () => ({ log: l, used: false })))
    .sort((a, b) => a.log.lengthFt - b.log.lengthFt || a.log.smallCirc - b.log.smallCirc);
  const have = new Map<Id, number>();
  const live = rows.filter((r) => !r.deleted).sort((a, b) => b.lengthFt - a.lengthFt || b.minCirc - a.minCirc);
  for (const row of live) {
    let got = 0;
    for (const u of units) {
      if (got >= row.quantity) break;
      if (!u.used && u.log.lengthFt >= row.lengthFt && u.log.smallCirc >= row.minCirc) {
        u.used = true;
        got++;
      }
    }
    have.set(row.id, got);
  }
  const extraCounts = new Map<Id, number>();
  for (const u of units) if (!u.used) extraCounts.set(u.log.id, (extraCounts.get(u.log.id) ?? 0) + 1);
  return { have, extras: [...extraCounts].map(([logId, count]) => ({ logId, count })) };
}

/** What is still to cut, merged by size, for the planner. Never negative; finished sizes are dropped. */
export function remainingPlannerRows(rows: NeedRow[], have: Map<Id, number>): PlannerRow[] {
  const merged = new Map<string, PlannerRow>();
  for (const r of rows) {
    if (r.deleted) continue;
    const key = rowKey(r.lengthFt, r.minCirc);
    const m = merged.get(key) ?? { key, lengthFt: r.lengthFt, minCirc: r.minCirc, remaining: 0, quantity: 0 };
    m.quantity += r.quantity;
    m.remaining += Math.max(0, r.quantity - (have.get(r.id) ?? 0));
    merged.set(key, m);
  }
  return [...merged.values()]
    .filter((r) => r.remaining > 0)
    .sort((a, b) => b.lengthFt - a.lengthFt || b.minCirc - a.minCirc);
}
