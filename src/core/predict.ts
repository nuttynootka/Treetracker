import { buildProfile, circAt, readingStations } from './profile';
import type { Profile, ProfilePoint, SettingsValues, Tree } from './types';

const PRIOR_TREES = 5; // the starting assumption counts as this many trees and fades out as trees are measured
const KERNEL_SIGMA_IN = 3; // trees within about 3 in of waist circumference count most
const MIN_TAPER = 0.05; // guards a 0 or negative taper setting, which would make the tree endless
const CAP_AFTER_TREES = 3; // the learned length cap needs this many usable trees

/** Trees that can teach the model: not deleted, and long enough to have at least one reading above the butt. */
export function usableTrees(trees: Tree[]): Tree[] {
  return trees.filter((t) => !t.deleted && t.waistCirc > 0 && t.lengthFt >= 6);
}

/** Straight taper from the waist estimate, running until the top circumference. */
export function priorProfile(waist: number, s: SettingsValues): Profile {
  const taper = Math.max(s.priorTaperPerFt, MIN_TAPER);
  const butt = waist + (s.waistHeightFt - s.stumpHeightFt) * taper;
  const lengthFt = Math.max(0, (butt - s.topCirc) / taper);
  const points: ProfilePoint[] = [{ xFt: 0, circ: butt }];
  for (const x of readingStations(lengthFt)) points.push({ xFt: x, circ: butt - taper * x });
  points.push({ xFt: lengthFt, circ: s.topCirc });
  return { points, lengthFt };
}

export function learnedMaxLengthFt(trees: Tree[]): number | null {
  const live = usableTrees(trees);
  return live.length >= CAP_AFTER_TREES ? 1.1 * Math.max(...live.map((t) => t.lengthFt)) : null;
}

/** Predicted profile for a tree of this waist circumference: the prior blended toward measured trees of similar size. */
export function predictProfile(waist: number, trees: Tree[], s: SettingsValues): Profile {
  const measured = usableTrees(trees);
  const prior = priorProfile(waist, s);
  if (measured.length === 0) return prior;

  const n = measured.length;
  const priorWeight = PRIOR_TREES * Math.max(0, 1 - n / PRIOR_TREES);
  const kernels = measured.map((t) => Math.exp(-((t.waistCirc - waist) ** 2) / (2 * KERNEL_SIGMA_IN ** 2)));
  const kSum = kernels.reduce((a, b) => a + b, 0);
  const weights = kernels.map((k) => (kSum > 0 ? (k / kSum) * n : 1));
  const profiles = measured.map((t) => buildProfile(t.lengthFt, t.buttCirc, t.readings, s.topCirc));

  const blend = (priorValue: number, value: (i: number) => number | null): number | null => {
    let num = priorWeight * priorValue;
    let den = priorWeight;
    measured.forEach((_, i) => {
      const v = value(i);
      if (v !== null) {
        num += weights[i] * v;
        den += weights[i];
      }
    });
    return den > 0 ? num / den : null;
  };

  const lengthRatio = blend(prior.lengthFt / waist, (i) => measured[i].lengthFt / measured[i].waistCirc)!;
  const cap = learnedMaxLengthFt(measured) ?? Infinity;
  const lengthFt = Math.min(lengthRatio * waist, cap);

  const points: ProfilePoint[] = [];
  let running = Infinity;
  for (const x of [0, ...readingStations(lengthFt)]) {
    const ratio = blend(circAt(prior, x) / waist, (i) =>
      x <= measured[i].lengthFt ? circAt(profiles[i], x) / measured[i].waistCirc : null,
    );
    if (ratio === null) continue;
    running = Math.min(running, Math.max(s.topCirc, ratio * waist));
    points.push({ xFt: x, circ: running });
  }
  points.push({ xFt: lengthFt, circ: s.topCirc });
  return { points, lengthFt };
}
