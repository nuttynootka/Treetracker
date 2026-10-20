import { buildProfile, circAt, readingStations } from './profile';
import type { Profile, ProfilePoint, SettingsValues, Tree } from './types';

const PRIOR_TREES = 5; // the starting assumption counts as this many trees and fades out as trees are measured
const KERNEL_SIGMA_IN = 3; // trees within about 3 in of waist circumference count most

/** Straight taper from the waist estimate, running until the top circumference. */
export function priorProfile(waist: number, s: SettingsValues): Profile {
  const butt = waist + (s.waistHeightFt - s.stumpHeightFt) * s.priorTaperPerFt;
  const lengthFt = Math.max(0, (butt - s.topCirc) / s.priorTaperPerFt);
  const points: ProfilePoint[] = [{ xFt: 0, circ: butt }];
  for (const x of readingStations(lengthFt)) points.push({ xFt: x, circ: butt - s.priorTaperPerFt * x });
  points.push({ xFt: lengthFt, circ: s.topCirc });
  return { points, lengthFt };
}

export function learnedMaxLengthFt(trees: Tree[]): number | null {
  const live = trees.filter((t) => !t.deleted);
  return live.length ? 1.1 * Math.max(...live.map((t) => t.lengthFt)) : null;
}

/** Predicted profile for a tree of this waist circumference: the prior blended toward measured trees of similar size. */
export function predictProfile(waist: number, trees: Tree[], s: SettingsValues): Profile {
  const measured = trees.filter((t) => !t.deleted && t.waistCirc > 0);
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
