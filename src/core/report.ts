import type { Recommendation } from './recommend';
import type { Tree } from './types';

export interface ReportInput {
  rows: { lengthFt: number; minCirc: number; needed: number; have: number; toCut: number }[];
  logs: { lengthFt: number; smallCirc: number; quantity: number; source: 'tree' | 'manual' }[];
  extras: number;
  rec: Recommendation | null;
  trees: Tree[];
  generatedAt: number;
  planName: string;
}

const keyText = (key: string) => {
  const [len, circ] = key.split('|');
  return `${len} ft logs ${circ} in around`;
};

function groupLogs(logs: ReportInput['logs']) {
  const g = new Map<string, ReportInput['logs'][number]>();
  for (const l of logs) {
    const k = `${l.lengthFt}|${l.smallCirc.toFixed(1)}|${l.source}`;
    const cur = g.get(k);
    if (cur) cur.quantity += l.quantity;
    else g.set(k, { ...l });
  }
  return [...g.values()].sort((a, b) => b.lengthFt - a.lengthFt || b.smallCirc - a.smallCirc);
}

/** Average absolute difference between predicted and measured readings, over trees that had a prediction. */
export function predictionError(trees: Tree[]): number | null {
  const diffs: number[] = [];
  for (const t of trees) {
    if (t.deleted || !t.predicted) continue;
    t.readings.forEach((r, i) => {
      const p = t.predicted!.readings[i];
      if (p !== undefined) diffs.push(Math.abs(p - r));
    });
  }
  return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
}

export function reportText(r: ReportInput): string {
  const out: string[] = [];
  out.push('TreeTracker report');
  out.push(new Date(r.generatedAt).toLocaleString());
  out.push(`Wall plan: ${r.planName}`);
  out.push('');
  out.push('Logs we have');
  const groups = groupLogs(r.logs);
  if (!groups.length) out.push('  None yet');
  for (const l of groups)
    out.push(`  ${l.quantity} × ${l.lengthFt} ft · ${l.smallCirc.toFixed(1)} in around (${l.source === 'tree' ? 'from trees' : 'added by hand'})`);
  if (r.extras) out.push(`  ${r.extras} of these are extra (no row needs them)`);
  out.push('');
  out.push('Logs still needed');
  for (const row of r.rows)
    out.push(`  ${row.lengthFt} ft · ${row.minCirc.toFixed(1)} in around — need ${row.needed} · have ${row.have} · to cut ${row.toCut}`);
  const need = r.rows.reduce((a, x) => a + x.needed, 0);
  const toCut = r.rows.reduce((a, x) => a + x.toCut, 0);
  out.push(`  Total: ${need - toCut} of ${need} done, ${toCut} to cut`);
  out.push('');
  out.push('Next trees to cut');
  if (!r.rec || !r.rec.next.length) out.push('  None');
  r.rec?.next.forEach((w, i) => out.push(`  ${i + 1}. ${w.toFixed(1)} in around at waist height`));
  out.push('');
  out.push('Trees still needed');
  if (!r.rec) out.push('  Not worked out yet');
  else if (r.rec.treesNeeded !== null) out.push(`  About ${r.rec.treesNeeded} (+${r.rec.spare} spare)`);
  else out.push(`  Cannot be finished with the trees measured so far: ${r.rec.unfillable.map(keyText).join('; ')}`);
  out.push('  This is a model estimate, not a prediction.');
  out.push('');
  out.push('Prediction error');
  const err = predictionError(r.trees);
  out.push(err === null ? '  No trees with a prediction yet' : `  Average error ${err.toFixed(1)} in around, per reading`);
  return out.join('\n') + '\n';
}

export function reportCsv(r: ReportInput): string {
  const lines = ['section,length_ft,circumference_in,needed,have,still_to_cut,quantity,source'];
  for (const row of r.rows) lines.push(`needed,${row.lengthFt},${row.minCirc.toFixed(1)},${row.needed},${row.have},${row.toCut},,`);
  for (const l of groupLogs(r.logs)) lines.push(`have,${l.lengthFt},${l.smallCirc.toFixed(1)},,,,${l.quantity},${l.source}`);
  return lines.join('\n') + '\n';
}
