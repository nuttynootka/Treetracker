import { circAt } from './profile';
import { round1 } from './num';
import type { Cut, CutPlan, PlannerRow, Profile, SettingsValues } from './types';

const EPS = 1e-9;

/** Value of cutting one more piece for a row that still needs `remaining`: longer, larger and scarcer rows weigh more. */
export function rowWeight(r: PlannerRow, remaining: number): number {
  return r.lengthFt * (r.minCirc / 12.6) * (1 + remaining / r.quantity);
}

interface Best {
  value: number;
  pieceIn: number; // total inches cut into pieces from here up; more means less waste
  next: number; // row index of the next piece, -1 to stop
}

/**
 * Exact best sequence of pieces from the butt up. Pieces are cut back to back, so the position
 * depends only on which pieces have been cut; the search memoises on those counts.
 */
export function planTree(p: Profile, rows: PlannerRow[], s: Pick<SettingsValues, 'kerfIn' | 'buttTrimIn'>): CutPlan {
  const live = rows.filter((r) => r.remaining > 0);
  const topIn = 12 * p.lengthFt;
  const used = live.map(() => 0);
  const memo = new Map<string, Best>();

  const best = (pos: number): Best => {
    const key = used.join(',');
    const hit = memo.get(key);
    if (hit) return hit;
    let out: Best = { value: 0, pieceIn: 0, next: -1 };
    for (let i = 0; i < live.length; i++) {
      const r = live[i];
      if (used[i] >= r.remaining) continue;
      const end = pos + 12 * r.lengthFt;
      if (end > topIn + EPS || circAt(p, end / 12) < r.minCirc - EPS) continue;
      const w = rowWeight(r, r.remaining - used[i]);
      used[i]++;
      const sub = best(end + s.kerfIn);
      used[i]--;
      const value = w + sub.value;
      const pieceIn = 12 * r.lengthFt + sub.pieceIn;
      if (value > out.value + EPS || (Math.abs(value - out.value) <= EPS && pieceIn > out.pieceIn)) {
        out = { value, pieceIn, next: i };
      }
    }
    memo.set(key, out);
    return out;
  };

  const cuts: Cut[] = [];
  let pos = s.buttTrimIn;
  for (let b = best(pos); b.next >= 0; b = best(pos)) {
    const r = live[b.next];
    const end = pos + 12 * r.lengthFt;
    cuts.push({ startIn: pos, endIn: end, lengthFt: r.lengthFt, smallCirc: round1(circAt(p, end / 12)), rowKey: r.key });
    used[b.next]++;
    pos = end + s.kerfIn;
  }
  const startIn = cuts.length ? pos : s.buttTrimIn;
  const pieceIn = cuts.reduce((t, c) => t + (c.endIn - c.startIn), 0);
  return {
    cuts,
    leftover: { startIn, lengthIn: Math.max(0, topIn - startIn), topCirc: p.points[p.points.length - 1].circ },
    wasteIn: topIn - pieceIn,
  };
}

export function planYield(plan: CutPlan): Map<string, number> {
  const y = new Map<string, number>();
  for (const c of plan.cuts) y.set(c.rowKey, (y.get(c.rowKey) ?? 0) + 1);
  return y;
}
