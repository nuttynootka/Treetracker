import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Clock } from '../core/hlc';
import { mergeRecords, parseSyncFile } from '../core/sync';
import type { Recommendation } from '../core/recommend';
import type { ShortfallSignal } from '../core/recalc';
import type { AnyRecord } from '../core/types';
import { createActions } from './actions';
import type { Actions } from './actions';
import { deriveState } from './derive';
import type { Derived } from './derive';
import { openRepo } from './db';
import type { Repo } from './db';
import { getDevice, setSyncTimes } from './local';
import type { WorkerRequest } from './recommend.worker';

export interface MergeSummary {
  added: number;
  updated: number;
  deleted: number;
  activePlanChanged: boolean;
}

export interface AppState {
  records: AnyRecord[];
  derived: Derived;
  rec: Recommendation | null;
  shortfall: ShortfallSignal[];
  busy: boolean;
  actions: Actions;
  run(fn: (records: AnyRecord[], derived: Derived) => AnyRecord[]): Promise<void>;
  importText(text: string): Promise<MergeSummary>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppStateProvider');
  return v;
}

export function AppStateProvider({ children, fallback }: { children: ComponentChildren; fallback: ComponentChildren }) {
  const device = useMemo(() => getDevice(), []);
  const clock = useMemo(() => new Clock(device.id), [device.id]);
  const actions = useMemo(() => createActions(clock, device, Date.now), [clock, device]);
  const [repo, setRepo] = useState<Repo | null>(null);
  const [records, setRecords] = useState<AnyRecord[] | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [shortfall, setShortfall] = useState<ShortfallSignal[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    openRepo()
      .then(async (r) => {
        const all = await r.all();
        for (const x of all) clock.receive(x.updatedAt);
        setRepo(r);
        setRecords(all);
      })
      .catch((e) => setError(String(e)));
    const w = new Worker(new URL('./recommend.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ seq: number; rec: Recommendation; shortfall: ShortfallSignal[] }>) => {
      if (e.data.seq !== seq.current) return;
      setRec(e.data.rec);
      setShortfall(e.data.shortfall);
      setBusy(false);
    };
    worker.current = w;
    return () => w.terminate();
  }, [clock]);

  const derived = useMemo(() => (records ? deriveState(records) : null), [records]);

  useEffect(() => {
    if (!derived || !worker.current) return;
    setBusy(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const msg: WorkerRequest = { seq: ++seq.current, remaining: derived.remaining, trees: derived.trees, settings: derived.settings };
      worker.current!.postMessage(msg);
    }, 150);
  }, [derived]);

  if (error) return <p role="alert">TreeTracker could not open its storage: {error}. Restart the app; if this keeps happening, export a sync file from the other phone as a backup.</p>;
  if (!repo || !records || !derived) return <>{fallback}</>;

  const save = async (changed: AnyRecord[]) => {
    if (!changed.length) return;
    await repo.put(changed);
    setRecords(await repo.all());
  };

  const value: AppState = {
    records,
    derived,
    rec,
    shortfall,
    busy,
    actions,
    run: (fn) => save(fn(records, derived)),
    async importText(text) {
      const file = parseSyncFile(text);
      const res = mergeRecords(records, file.records);
      if (res.maxHlc) clock.receive(res.maxHlc);
      await save(res.changed);
      const summary = { added: res.added, updated: res.updated, deleted: res.deleted, activePlanChanged: res.activePlanChanged };
      setSyncTimes({ lastImport: Date.now(), lastImportSummary: `${res.added} added, ${res.updated} updated, ${res.deleted} deleted` });
      return summary;
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
