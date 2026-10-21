import { useRef, useState } from 'preact/hooks';
import { LOGS_PLAN_MIN_LOGS, planFromLogs } from '../../core/logsplan';
import type { LogsPlan } from '../../core/logsplan';
import { buildPlanFile, parsePlanFile, planFileName } from '../../core/planfile';
import { comparePlanFromLogs } from '../../core/recalc';
import { SyncError } from '../../core/sync';
import type { ActivePlan, PlanVersion } from '../../core/types';
import { useApp } from '../../store/app-state';
import { isCancel, pickTextFile, shareFile } from '../../platform/share';
import { Button, Screen } from '../components';
import { dateText, fmtIn, sizeLabel } from '../format';
import { NameSheet } from './NameSheet';
import { courseText } from './WallPlan';

type ReadyPlan = Extract<LogsPlan, { ok: true }>;
type Preview = ReadyPlan & { cmp: ReturnType<typeof comparePlanFromLogs> };

function LogsPlanPreview({ p, target, highest, onSave, onClose }: {
  p: Preview;
  target: { exterior: number; interior: number };
  highest: { exterior: number; interior: number };
  onSave: () => void;
  onClose: () => void;
}) {
  const t = (n: number | null) => (n === null ? 'cannot finish' : `about ${n}`);
  const side = (label: string, avg: number, courses: number[], height: number, added: boolean, tgt: number, hi: number, min: number) => (
    <div class="stack">
      <strong>{label}</strong>
      <p class="muted-line">Average of the {label === 'Exterior' ? '20 largest' : '20 smallest'} logs: {fmtIn(avg)} around</p>
      <p class="muted-line">{courses.length} courses stack to {fmtIn(height)} (target {fmtIn(tgt)})</p>
      {added && <p class="msg msg-warn">One course was added so the wall reaches at least 82 in.</p>}
      {height > hi + 1e-9 && <p class="msg msg-warn">This is over the {fmtIn(hi)} allowed height.</p>}
      <p class="muted-line secondary">Every {label.toLowerCase()} row needs at least {fmtIn(min)} around at the small end.</p>
    </div>
  );
  return (
    <div class="card raised-lg" data-testid="logs-plan">
      <h2 style={{ marginTop: 0 }}>Plan from my logs</h2>
      <p class="muted-line secondary">Built from {p.count} logs you have cut. Nothing changes unless you save it and then use it.</p>
      {side('Exterior', p.exteriorAvg, p.exteriorCourses, p.exteriorHeightIn, p.exteriorAdded, target.exterior, highest.exterior, p.rowMinimums.exterior)}
      {side('Interior', p.interiorAvg, p.interiorCourses, p.interiorHeightIn, p.interiorAdded, target.interior, highest.interior, p.rowMinimums.interior)}
      <p class="muted-line">{p.cmp.deltaPieces >= 0 ? '+' : ''}{p.cmp.deltaPieces} pieces, {p.cmp.deltaFeet >= 0 ? '+' : ''}{p.cmp.deltaFeet} ft of log compared with the plan in use</p>
      <p class="muted-line">Trees still needed: {t(p.cmp.treesNeededBefore)} now → {t(p.cmp.treesNeededAfter)}</p>
      <p class="muted-line">{p.cmp.logsStillCounting} of {p.cmp.logsTotal} logs already cut would count</p>
      <p class="muted-line secondary">{p.rows.map((r) => `${r.quantity} × ${sizeLabel(r.lengthFt, r.minCirc)}`).join('; ')}</p>
      <div class="row-buttons">
        <Button variant="primary" onClick={onSave}>Save as plan</Button>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

function PlanCard({ plan, name, inUse, onMsg }: { plan: PlanVersion; name: string; inUse: boolean; onMsg: (m: string) => void }) {
  const app = useApp();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);
  const act = async (fn: Parameters<typeof app.run>[0], done: string) => {
    if (busy.current) return;
    busy.current = true;
    const ok = await app.run(fn);
    busy.current = false;
    if (ok) onMsg(done);
  };
  return (
    <div class={`card raised${inUse ? ' row-done' : ''}`} data-testid="plan-card">
      <div class="row-buttons" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <strong class="plan-name">{name}</strong>
        {inUse && <span class="tag">In use</span>}
      </div>
      <p class="muted-line secondary">{plan.createdAt ? dateText(plan.createdAt) : 'Built in'}{plan.note ? ` · ${plan.note}` : ''}</p>
      <p class="muted-line">Exterior: {courseText(plan.exteriorCourses)}</p>
      <p class="muted-line">Interior: {courseText(plan.interiorCourses)}</p>
      {confirmDelete ? (
        <div class="stack">
          <p class="label">Delete "{name}"? It is removed from both phones at the next sync.</p>
          <div class="row-buttons">
            <Button onClick={() => act((recs) => app.actions.deletePlan(plan, recs), `Deleted "${name}".`)}>Yes, delete</Button>
            <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
          </div>
        </div>
      ) : (
        <div class="row-buttons">
          {!inUse && <Button variant="primary" onClick={() => act((recs) => app.actions.usePlan(plan.id, recs), `Now using "${name}".`)}>Use this plan</Button>}
          <Button onClick={() => setRenaming(true)}>Rename</Button>
          <Button onClick={async () => {
            const now = Date.now();
            try {
              await shareFile(planFileName(name, now), 'application/json', JSON.stringify(buildPlanFile({ ...plan, name }, now)));
              onMsg(`Plan file for "${name}" created.`);
            } catch (e) {
              if (!isCancel(e)) onMsg(`The plan file could not be exported: ${e instanceof Error ? e.message : String(e)}`);
            }
          }}>Export file</Button>
          {!inUse && (plan.archived
            ? <Button onClick={() => act((recs) => app.actions.setArchived(plan, false, recs), `"${name}" is back in the list.`)}>Unarchive</Button>
            : <Button onClick={() => act((recs) => app.actions.setArchived(plan, true, recs), `Archived "${name}".`)}>Archive</Button>)}
          {!inUse && <Button onClick={() => setConfirmDelete(true)}>Delete…</Button>}
        </div>
      )}
      {renaming && (
        <NameSheet title="Rename plan" initial={name} saveLabel="Save name" onClose={() => setRenaming(false)}
          onSave={(n) => act((recs) => app.actions.renamePlan(plan, n, recs), `Renamed to "${n}".`)} />
      )}
    </div>
  );
}

export function Plans() {
  const app = useApp();
  const d = app.derived;
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState(false);
  const [naming, setNaming] = useState(false);
  const logCount = d.logs.reduce((a, l) => a + l.quantity, 0);
  const active = app.records.find((r): r is ActivePlan => r.type === 'active');
  const prev = d.plans.find((p) => p.id === active?.previousPlanId && p.id !== d.plan.id);
  const shown = d.plans.filter((p) => !p.archived || p.id === d.plan.id);
  const archived = d.plans.filter((p) => p.archived && p.id !== d.plan.id);
  const w = d.plan.wall;

  return (
    <Screen title="Plans">
      <p class="muted-line">Plan in use: <strong>{d.planNames.get(d.plan.id)}</strong>. Logs needed is built from it.</p>
      <div class="stack">
        <Button wide disabled={working || logCount < LOGS_PLAN_MIN_LOGS} onClick={() => {
          setWorking(true);
          setMsg('');
          setTimeout(() => {
            const lp = planFromLogs(d.logs, d.plan);
            if (lp.ok) setPreview({ ...lp, cmp: comparePlanFromLogs(lp, { logs: d.logs, trees: d.trees, s: d.settings, rows: d.activeRows }) });
            setWorking(false);
          }, 30);
        }}>{working ? 'Working…' : 'Plan from my logs'}</Button>
        {logCount < LOGS_PLAN_MIN_LOGS && (
          <p class="muted-line secondary">Needs more than 40 logs recorded. You have {logCount}.</p>
        )}
        <Button wide onClick={async () => {
          const text = await pickTextFile();
          if (text === null) return;
          try {
            const plan = parsePlanFile(text);
            let dup: PlanVersion | null = null;
            const ok = await app.run((recs) => {
              const res = app.actions.importPlan(plan, recs);
              dup = res.duplicateOf;
              return res.changed;
            });
            if (!ok) return;
            const found = dup as PlanVersion | null;
            setMsg(found ? `This plan is already in your list as "${d.planNames.get(found.id) ?? found.name}". Nothing was added.` : `Imported "${plan.name ?? 'Imported plan'}". Tap Use this plan to switch to it.`);
          } catch (e) {
            setMsg(e instanceof SyncError ? e.message : `Import failed: ${String(e)}`);
          }
        }}>Import plan file</Button>
        <Button wide disabled={!prev} onClick={async () => {
          if (prev && (await app.run((recs) => app.actions.switchBack(recs)))) setMsg(`Now using "${d.planNames.get(prev.id)}".`);
        }}>{prev ? `Switch back to "${d.planNames.get(prev.id)}"` : 'Switch back (no earlier plan)'}</Button>
      </div>
      {msg && <p class="label card raised" role="status" data-testid="plans-msg">{msg}</p>}

      {preview && (
        <LogsPlanPreview p={preview}
          target={{ exterior: w.exteriorHeightIn, interior: w.interiorHeightIn }}
          highest={{ exterior: w.exteriorHeightIn + w.toleranceAboveIn, interior: w.interiorHeightIn + w.toleranceAboveIn }}
          onSave={() => setNaming(true)} onClose={() => setPreview(null)} />
      )}
      {naming && preview && (
        <NameSheet title="Save plan from my logs" saveLabel="Save plan" initial={`From my logs ${dateText(Date.now())}`}
          onClose={() => setNaming(false)}
          onSave={async (name) => {
            const ok = await app.run((recs) => app.actions.savePlan(
              { exteriorCourses: preview.exteriorCourses, interiorCourses: preview.interiorCourses, rowMinimums: preview.rowMinimums, note: `From the ${preview.count} logs cut` },
              name, recs));
            if (ok) {
              setPreview(null);
              setMsg(`Saved "${name}". Tap Use this plan to switch to it.`);
            }
          }} />
      )}

      <h2>Saved plans</h2>
      {shown.map((p) => <PlanCard key={p.id} plan={p} name={d.planNames.get(p.id)!} inUse={p.id === d.plan.id} onMsg={setMsg} />)}
      {archived.length > 0 && (
        <details class="archived">
          <summary class="btn">Archived ({archived.length})</summary>
          {archived.map((p) => <PlanCard key={p.id} plan={p} name={d.planNames.get(p.id)!} inUse={false} onMsg={setMsg} />)}
        </details>
      )}
    </Screen>
  );
}
