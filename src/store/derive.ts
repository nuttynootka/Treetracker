import { matchLogs, remainingPlannerRows } from '../core/matching';
import { planName } from '../core/planfile';
import type { LogCut, NeedRow, PlannerRow, PlanVersion, Settings, AnyRecord, Tree, ActivePlan } from '../core/types';

export interface RowView {
  row: NeedRow;
  have: number;
  toCut: number;
  done: boolean;
}

export interface Derived {
  settings: Settings;
  plan: PlanVersion;
  /** Plan versions in a fixed order every phone agrees on. */
  plans: PlanVersion[];
  /** The number shown for each plan: its place in `plans`, so two phones that both made a "version 2" still show 2 and 3. */
  versionOf: Map<string, number>;
  /** Display name of every plan, by id. */
  planNames: Map<string, string>;
  activeRows: NeedRow[];
  rowViews: RowView[];
  extras: { log: LogCut; count: number }[];
  trees: Tree[];
  logs: LogCut[];
  remaining: PlannerRow[];
  totals: { needed: number; have: number };
}

export function deriveState(records: AnyRecord[]): Derived {
  const settings = records.find((r): r is Settings => r.type === 'settings')!;
  const active = records.find((r): r is ActivePlan => r.type === 'active')!;
  const plans = records
    .filter((r): r is PlanVersion => r.type === 'plan' && !r.deleted)
    .sort((a, b) => a.version - b.version || a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const versionOf = new Map(plans.map((p, i) => [p.id, i + 1]));
  const planNames = new Map(plans.map((p, i) => [p.id, planName(p, i + 1)]));
  const plan = plans.find((p) => p.id === active.planVersionId) ?? plans[plans.length - 1];
  const activeRows = records
    .filter((r): r is NeedRow => r.type === 'need' && !r.deleted && (r.planVersionId === plan.id || r.planVersionId === null))
    .sort((a, b) => b.lengthFt - a.lengthFt || b.minCirc - a.minCirc);
  const logs = records.filter((r): r is LogCut => r.type === 'log' && !r.deleted).sort((a, b) => b.createdAt - a.createdAt);
  const trees = records.filter((r): r is Tree => r.type === 'tree' && !r.deleted).sort((a, b) => b.createdAt - a.createdAt);
  const m = matchLogs(activeRows, logs);
  const rowViews = activeRows.map((row) => {
    const have = m.have.get(row.id) ?? 0;
    const toCut = Math.max(0, row.quantity - have);
    return { row, have, toCut, done: toCut === 0 };
  });
  const byId = new Map(logs.map((l) => [l.id, l]));
  return {
    settings,
    plan,
    plans,
    versionOf,
    planNames,
    activeRows,
    rowViews,
    extras: m.extras.map((e) => ({ log: byId.get(e.logId)!, count: e.count })),
    trees,
    logs,
    remaining: remainingPlannerRows(activeRows, m.have),
    totals: { needed: rowViews.reduce((a, v) => a + v.row.quantity, 0), have: rowViews.reduce((a, v) => a + Math.min(v.have, v.row.quantity), 0) },
  };
}
