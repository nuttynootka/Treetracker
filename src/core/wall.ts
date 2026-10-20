import type { WallSettings } from './types';

export interface GeneratedRow {
  lengthFt: number;
  minCirc: number;
  quantity: number;
}

/** Finished piece length: centerline minus the corner post width plus a tenon on each end, to the nearest inch. */
export function pieceLengthIn(centerlineIn: number, w: WallSettings): number {
  return Math.round(centerlineIn - w.postWidthIn + 2 * w.tenonIn);
}

export function courseHeight(circ: number, w: WallSettings): number {
  return w.courseHeightIn[circ.toFixed(1)] ?? circ / Math.PI;
}

export function stackHeight(courses: number[], w: WallSettings): number {
  return courses.reduce((s, c) => s + courseHeight(c, w), 0);
}

/** Regenerate the logs-needed rows from the course plan: every piece rounded up to whole feet, grouped by length and circumference. */
export function generateRows(exteriorCourses: number[], interiorCourses: number[], w: WallSettings): GeneratedRow[] {
  const counts = new Map<string, GeneratedRow>();
  const add = (pieceIn: number, circ: number) => {
    const lengthFt = Math.ceil(pieceIn / 12);
    const key = `${lengthFt}|${circ.toFixed(1)}`;
    const row = counts.get(key) ?? { lengthFt, minCirc: circ, quantity: 0 };
    row.quantity++;
    counts.set(key, row);
  };
  for (const circ of exteriorCourses)
    for (const wall of w.exteriorWalls) if (wall.hasLogs) add(pieceLengthIn(wall.centerlineIn, w), circ);
  for (const circ of interiorCourses) for (const p of w.interiorPiecesIn) add(p, circ);
  return [...counts.values()].sort((a, b) => b.lengthFt - a.lengthFt || b.minCirc - a.minCirc);
}
