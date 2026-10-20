import { compareHlc } from './hlc';
import type { AnyRecord, Hlc } from './types';

export interface SyncFile {
  format: 'treetracker-sync';
  version: 1;
  deviceId: string;
  deviceName: string;
  exportedAt: number;
  records: AnyRecord[];
}

export class SyncError extends Error {}

export function buildExport(records: AnyRecord[], device: { id: string; name: string }, now: number): SyncFile {
  return { format: 'treetracker-sync', version: 1, deviceId: device.id, deviceName: device.name, exportedAt: now, records };
}

export function syncFileName(deviceName: string, now: number): string {
  const slug = deviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phone';
  const d = new Date(now);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `treetracker-sync-${slug}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

export function parseSyncFile(text: string): SyncFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SyncError('This file could not be read. Choose a TreeTracker sync file.');
  }
  const f = data as Partial<SyncFile>;
  if (!f || f.format !== 'treetracker-sync') throw new SyncError('This is not a TreeTracker sync file.');
  if (f.version !== 1) throw new SyncError('This sync file comes from a newer version of TreeTracker. Update the app on this phone first.');
  if (!Array.isArray(f.records)) throw new SyncError('This sync file is damaged: it has no records.');
  return f as SyncFile;
}

export interface MergeResult {
  changed: AnyRecord[];
  added: number;
  updated: number;
  deleted: number;
  activePlanChanged: boolean;
  maxHlc: Hlc | null;
}

/** Record-by-record merge: the newer edit wins, deletions included. Returns only the records that change locally. */
export function mergeRecords(local: AnyRecord[], incoming: AnyRecord[]): MergeResult {
  const mine = new Map(local.map((r) => [r.id, r]));
  const res: MergeResult = { changed: [], added: 0, updated: 0, deleted: 0, activePlanChanged: false, maxHlc: null };
  for (const r of incoming) {
    if (!r || typeof r.id !== 'string' || typeof r.updatedAt !== 'string') continue;
    if (res.maxHlc === null || compareHlc(r.updatedAt, res.maxHlc) > 0) res.maxHlc = r.updatedAt;
    const cur = mine.get(r.id);
    if (cur && compareHlc(r.updatedAt, cur.updatedAt) <= 0) continue;
    res.changed.push(r);
    if (!cur) res.added++;
    else if (r.deleted && !cur.deleted) res.deleted++;
    else res.updated++;
    if (r.type === 'active' && (!cur || (cur.type === 'active' && cur.planVersionId !== r.planVersionId))) res.activePlanChanged = true;
  }
  return res;
}
