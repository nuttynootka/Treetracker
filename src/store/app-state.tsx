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
  /** Saves the change; resolves false (and shows an alert) if it could not be saved. */
  run(fn: (records: AnyRecord[], derived: Derived) => AnyRecord[]): Promise<boolean>;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
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

  // The plan in use was deleted on the other phone: keep it here, because it is still in use, and say so.
  useEffect(() => {
    if (!repo || !records || !derived?.activePlanDeleted) return;
    const name = derived.planNames.get(derived.plan.id) ?? 'the plan in use';
    const fix = actions.repairActivePlan(records);
    repo.put(fix).then(async () => {
      setRecords(await repo.all());
      setPlanNotice(`"${name}" was deleted on the other phone, but it is still in use on this phone, so it was kept. To remove it, switch to another plan first, then delete it.`);
    }).catch((e) => setSaveError(e instanceof Error ? e.message : String(e)));
  }, [derived, repo]);

  if (error) return <p role="alert">TreeTracker could not open its storage: {error}. Restart the app; if this keeps happening, export a sync file from the other phone as a backup.</p>;
  if (!repo || !records || !derived) return <>{fallback}</>;

  const save = async (changed: AnyRecord[]): Promise<boolean> => {
    if (!changed.length) return true;
    try {
      await repo.put(changed);
      setRecords(await repo.all());
      setSaveError(null);
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const value: AppState = {
    records,
    derived,
    rec,
    shortfall,
    busy,
    actions,
    run: async (fn) => {
      let changed: AnyRecord[];
      try {
        changed = fn(records, derived);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        return false;
      }
      return save(changed);
    },
    async importText(text) {
      const file = parseSyncFile(text);
      const res = mergeRecords(records, file.records);
      if (res.maxHlc) clock.receive(res.maxHlc);
      if (!(await save(res.changed))) throw new Error('The imported records could not be saved on this phone.');
      const summary = { added: res.added, updated: res.updated, deleted: res.deleted, activePlanChanged: res.activePlanChanged };
      setSyncTimes({ lastImport: Date.now(), lastImportSummary: `${res.added} added, ${res.updated} updated, ${res.deleted} deleted` });
      return summary;
    },
  };
  return (
    <Ctx.Provider value={value}>
      {saveError && (
        <div class="banner raised save-error" role="alert">
          <strong>Your last change could not be saved.</strong>
          <div class="banner-body">
            The phone said: {saveError}. If the phone is full, free some space. Then open Sync and export a sync file as a backup.
          </div>
          <div class="row-buttons">
            <button type="button" class="btn" onClick={() => setSaveError(null)}>Dismiss</button>
            <button type="button" class="btn" onClick={() => { setSaveError(null); location.hash = '/sync'; }}>Open Sync</button>
          </div>
        </div>
      )}
      {planNotice && (
        <div class="banner raised save-error" role="alert">
          <strong>Plan kept</strong>
          <div class="banner-body">{planNotice}</div>
          <div class="row-buttons"><button type="button" class="btn" onClick={() => setPlanNotice(null)}>OK</button></div>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}
