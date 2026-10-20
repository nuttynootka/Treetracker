import type { Profile, SettingsValues } from './types';

/** Every multiple of 6 ft strictly below the tree length: where the form asks for a circumference. */
export function readingStations(lengthFt: number): number[] {
  const out: number[] = [];
  for (let x = 6; x < lengthFt; x += 6) out.push(x);
  return out;
}

export function buildProfile(lengthFt: number, buttCirc: number, readings: number[], topCirc: number): Profile {
  const stations = readingStations(lengthFt);
  const points = [{ xFt: 0, circ: buttCirc }];
  stations.forEach((x, i) => {
    if (readings[i] !== undefined) points.push({ xFt: x, circ: readings[i] });
  });
  points.push({ xFt: lengthFt, circ: topCirc });
  return { points, lengthFt };
}

/** Circumference at xFt from the butt, by linear interpolation, clamped to the end points. */
export function circAt(p: Profile, xFt: number): number {
  const pts = p.points;
  if (xFt <= pts[0].xFt) return pts[0].circ;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (xFt <= b.xFt) {
      if (b.xFt === a.xFt) return b.circ;
      return a.circ + ((xFt - a.xFt) / (b.xFt - a.xFt)) * (b.circ - a.circ);
    }
  }
  return pts[pts.length - 1].circ;
}

export function waistCirc(p: Profile, s: Pick<SettingsValues, 'waistHeightFt' | 'stumpHeightFt'>): number {
  const x = s.waistHeightFt - s.stumpHeightFt;
  return x <= 0 ? p.points[0].circ : circAt(p, x);
}

export function validateTree(
  lengthFt: number | null,
  buttCirc: number | null,
  readings: (number | null)[],
  topCirc: number,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (lengthFt === null || lengthFt <= 0) errors.push('Enter the tree length cut, in feet.');
  if (buttCirc === null || buttCirc <= 0) errors.push('Enter the circumference at the butt, in inches.');
  if (lengthFt !== null && lengthFt > 0) {
    if (lengthFt < 4 || lengthFt > 120) warnings.push('Tree length is outside 4 to 120 ft. Check it was typed right.');
    const stations = readingStations(lengthFt);
    stations.forEach((x, i) => {
      const r = readings[i];
      if (r === null || r === undefined || r <= 0) errors.push(`Enter the circumference at ${x} ft.`);
    });
  }
  const all = [buttCirc, ...readings].filter((v): v is number => v !== null && v !== undefined && v > 0);
  if (all.some((v) => v < 5 || v > 80)) warnings.push('A circumference is outside 5 to 80 in. Check it was typed right.');
  for (let i = 1; i < all.length; i++) {
    if (all[i] > all[i - 1]) {
      warnings.push('A circumference increases going up the tree. Check the readings.');
      break;
    }
  }
  if (readings.some((v) => v !== null && v !== undefined && v > 0 && v < topCirc))
    warnings.push(`A circumference is below ${topCirc} in before the top of the tree. Check the readings or the length.`);
  return { errors, warnings };
}
