import { circAt } from './profile';
import { round1 } from './num';
import type { Cut, CutPlan, PlannerRow, Profile, SettingsValues } from './types';

const EPS = 1e-9;

/**
 * Value of one piece for a row: longer, larger and scarcer rows weigh more. Scarcity uses the
 * row's remaining count when the tree is planned, so every piece of a row in one tree has the same value.
 */
export function rowWeight(r: PlannerRow, remaining: number = r.remaining): number {
  return r.lengthFt * (r.minCirc / 12.6) * (1 + remaining / r.quantity);
}

/** The trunk as planned: never thicker than any point below it. Equal to the profile when readings only decrease. */
function envelope(p: Profile): Profile {
  let run = Infinity;
  return { lengthFt: p.lengthFt, points: p.points.map((pt) => ({ xFt: pt.xFt, circ: (run = Math.min(run, pt.circ)) })) };
}

interface Best {
  value: number;
  pieceIn: number; // inches cut into pieces from here up; more means less waste
  take: number[] | null; // counts per row of the current class; null past the last class
}

/**
 * Exact best set of pieces from the butt up on a trunk that never gets thicker going up.
 * Putting the larger-minimum pieces lower never breaks feasibility, so pieces are cut class by class,
 * largest circumference first, and a class group is feasible when its last piece's small end is.
 * Position depends only on total feet and number of pieces, so the search memoises on
 * (class, feet, pieces) and enumerates how many of each length to take within a class.
 */
export function planTree(p: Profile, rows: PlannerRow[], s: Pick<SettingsValues, 'kerfIn' | 'buttTrimIn'>): CutPlan {
  const env = envelope(p);
  const topIn = 12 * p.lengthFt;
  const live = rows.filter((r) => r.remaining > 0 && s.buttTrimIn + 12 * r.lengthFt <= topIn + EPS);
  const circs = [...new Set(live.map((r) => r.minCirc))].sort((a, b) => b - a);
  const classes = circs.map((c) => live.filter((r) => r.minCirc === c).sort((a, b) => b.lengthFt - a.lengthFt));
  const weights = classes.map((cls) => cls.map((r) => rowWeight(r)));
  const memo = new Map<string, Best>();
  const posOf = (feet: number, pieces: number) => s.buttTrimIn + 12 * feet + s.kerfIn * pieces;

  const best = (k: number, feet: number, pieces: number): Best => {
    if (k === classes.length) return { value: 0, pieceIn: 0, take: null };
    const key = `${k},${feet},${pieces}`;
    const hit = memo.get(key);
    if (hit) return hit;
    const cls = classes[k];
    const take = cls.map(() => 0);
    const skip = best(k + 1, feet, pieces);
    let out: Best = { value: skip.value, pieceIn: skip.pieceIn, take: cls.map(() => 0) };

    const visit = (i: number, addFeet: number, addPieces: number, value: number) => {
      if (i === cls.length) {
        if (addPieces === 0) return;
        const end = posOf(feet, pieces) + 12 * addFeet + s.kerfIn * (addPieces - 1);
        if (end > topIn + EPS || circAt(env, end / 12) < circs[k] - EPS) return;
        const sub = best(k + 1, feet + addFeet, pieces + addPieces);
        const v = value + sub.value;
        const inches = 12 * addFeet + sub.pieceIn;
        if (v > out.value + EPS || (Math.abs(v - out.value) <= EPS && inches > out.pieceIn)) {
          out = { value: v, pieceIn: inches, take: [...take] };
        }
        return;
      }
      const r = cls[i];
      for (let n = 0; n <= r.remaining; n++) {
        const end = posOf(feet, pieces) + 12 * (addFeet + n * r.lengthFt) + s.kerfIn * (addPieces + n - 1);
        if (n > 0 && end > topIn + EPS) break;
        take[i] = n;
        visit(i + 1, addFeet + n * r.lengthFt, addPieces + n, value + n * weights[k][i]);
      }
      take[i] = 0;
    };
    visit(0, 0, 0, 0);
    memo.set(key, out);
    return out;
  };

  const cuts: Cut[] = [];
  let feet = 0;
  let pieces = 0;
  for (let k = 0; k < classes.length; k++) {
    const b = best(k, feet, pieces);
    const t = b.take ?? [];
    classes[k].forEach((r, i) => {
      for (let n = 0; n < (t[i] ?? 0); n++) {
        const start = posOf(feet, pieces);
        const end = start + 12 * r.lengthFt;
        cuts.push({ startIn: start, endIn: end, lengthFt: r.lengthFt, smallCirc: round1(circAt(p, end / 12)), rowKey: r.key });
        feet += r.lengthFt;
        pieces++;
      }
    });
  }
  const startIn = cuts.length ? posOf(feet, pieces) : s.buttTrimIn;
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
