import { useState } from 'preact/hooks';
import { parseNumber } from '../../core/num';
import { candidatePlans, comparePlan, supplyableClasses } from '../../core/recalc';
import type { CandidatePlan } from '../../core/recalc';
import { courseHeight, generateRows, stackHeight } from '../../core/wall';
import type { PlanVersion, WallSettings } from '../../core/types';
import { useApp } from '../../store/app-state';
import { Banner, Button, NumberField, Screen, Sheet } from '../components';
import { dateText, fmtIn, sizeLabel } from '../format';

const CLASSES = [28.3, 25.2, 18.9, 15.8, 12.6];
type Side = 'exterior' | 'interior';

function courseText(courses: number[]) {
  const groups: [number, number][] = [];
  for (const c of courses) {
    const last = groups[groups.length - 1];
    if (last && last[0] === c) last[1]++;
    else groups.push([c, 1]);
  }
  return groups.map(([c, n]) => `${n} × ${c.toFixed(1)} in`).join(', then ');
}

function CoursesCard({ plan, side }: { plan: PlanVersion; side: Side }) {
  const courses = side === 'exterior' ? plan.exteriorCourses : plan.interiorCourses;
  const target = side === 'exterior' ? plan.wall.exteriorHeightIn : plan.wall.interiorHeightIn;
  return (
    <div class="card raised">
      <strong>{side === 'exterior' ? 'Exterior' : 'Interior'} courses, bottom to top</strong>
      <p class="muted-line">{courseText(courses)}</p>
      <p class="muted-line secondary">{courses.length} courses stack to {fmtIn(stackHeight(courses, plan.wall))} (target {fmtIn(target)})</p>
    </div>
  );
}

type Compared = CandidatePlan & { cmp: ReturnType<typeof comparePlan> };

function CandidateCard({ c, onAccept, onEdit, onDismiss }: { c: Compared; onAccept: () => void; onEdit: () => void; onDismiss: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const t = (n: number | null) => (n === null ? 'cannot finish' : `about ${n}`);
  return (
    <div class="card raised-lg" data-testid="candidate">
      <strong>{c.side === 'exterior' ? 'Exterior' : 'Interior'}: {courseText(c.courses)}</strong>
      <p class="muted-line">Height {fmtIn(c.heightIn)} ({c.diffIn >= 0 ? '+' : ''}{c.diffIn.toFixed(1)} in from target)</p>
      <p class="muted-line">{c.cmp.deltaPieces >= 0 ? '+' : ''}{c.cmp.deltaPieces} pieces, {c.cmp.deltaFeet >= 0 ? '+' : ''}{c.cmp.deltaFeet} ft of log</p>
      <p class="muted-line">Trees still needed: {t(c.cmp.treesNeededBefore)} now → {t(c.cmp.treesNeededAfter)}</p>
      <p class="muted-line">{c.cmp.logsStillCounting} of {c.cmp.logsTotal} logs already cut still count</p>
      <p class="muted-line secondary">{c.rows.map((r) => `${r.quantity} × ${sizeLabel(r.lengthFt, r.minCirc)}`).join('; ')}</p>
      {confirm ? (
        <div class="stack">
          <p class="label">Use this plan? Logs needed will be rebuilt from it. Hand edits to the current plan's rows will not carry over. You can undo this.</p>
          <div class="row-buttons">
            <Button variant="primary" onClick={onAccept}>Yes, use this plan</Button>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div class="row-buttons">
          <Button variant="primary" onClick={() => setConfirm(true)}>Accept</Button>
          <Button onClick={onEdit}>Edit</Button>
          <Button onClick={onDismiss}>Dismiss</Button>
        </div>
      )}
    </div>
  );
}

function WallEditor({ plan, onClose }: { plan: PlanVersion; onClose: () => void }) {
  const app = useApp();
  const w = plan.wall;
  const [vals, setVals] = useState<Record<string, string>>({
    post: String(w.postWidthIn), tenon: String(w.tenonIn), ext: String(w.exteriorHeightIn), int: String(w.interiorHeightIn),
    below: String(w.toleranceBelowIn), above: String(w.toleranceAboveIn), pieces: w.interiorPiecesIn.join(', '),
    ...Object.fromEntries(w.exteriorWalls.map((x, i) => [`wall${i}`, String(x.centerlineIn)])),
    ...Object.fromEntries(CLASSES.map((c) => [`h${c}`, (w.courseHeightIn[c.toFixed(1)] ?? courseHeight(c, w)).toFixed(2)])),
  });
  const [logs, setLogs] = useState(w.exteriorWalls.map((x) => x.hasLogs));
  const set = (k: string) => (v: string) => setVals((x) => ({ ...x, [k]: v }));
  const n = (k: string) => parseNumber(vals[k] ?? '');
  const pieces = (vals.pieces ?? '').split(/[ ,]+/).filter(Boolean).map(parseNumber);
  const numKeys = ['post', 'tenon', 'ext', 'int', 'below', 'above', ...w.exteriorWalls.map((_, i) => `wall${i}`), ...CLASSES.map((c) => `h${c}`)];
  const ok = numKeys.every((k) => n(k) !== null && n(k)! >= 0) && pieces.length > 0 && pieces.every((p) => p !== null && p > 0);
  return (
    <Sheet open title="Edit walls" onClose={onClose}>
      <p class="muted-line secondary">Saving makes a new plan version. You can undo it.</p>
      {w.exteriorWalls.map((x, i) => (
        <div key={x.name}>
          <NumberField id={`ww${i}`} label={`${x.name} centerline length (in)`} value={vals[`wall${i}`]} onInput={set(`wall${i}`)} />
          <label class="check"><input type="checkbox" checked={logs[i]} onChange={(e) => setLogs((l) => l.map((v, j) => (j === i ? (e.target as HTMLInputElement).checked : v)))} />{x.name} has wall logs (untick for a door wall)</label>
        </div>
      ))}
      <div class="field">
        <label for="wpieces">Interior pieces per course (in, separated by commas)</label>
        <input id="wpieces" class="inset" value={vals.pieces} onInput={(e) => set('pieces')((e.target as HTMLInputElement).value)} />
      </div>
      <NumberField id="wpost" label="Corner post width (in)" value={vals.post} onInput={set('post')} />
      <NumberField id="wtenon" label="Tenon length (in)" value={vals.tenon} onInput={set('tenon')} />
      <NumberField id="wext" label="Exterior wall height of logs (in)" value={vals.ext} onInput={set('ext')} />
      <NumberField id="wint" label="Interior wall height of logs (in)" value={vals.int} onInput={set('int')} />
      <NumberField id="wbelow" label="Allowed below target (in)" value={vals.below} onInput={set('below')} />
      <NumberField id="wabove" label="Allowed above target (in)" value={vals.above} onInput={set('above')} />
      {CLASSES.map((c) => <NumberField key={c} id={`wh${c}`} label={`Course height for ${c.toFixed(1)} in around logs (in)`} value={vals[`h${c}`]} onInput={set(`h${c}`)} />)}
      <Button variant="primary" wide disabled={!ok} onClick={async () => {
        const courseHeightIn: Record<string, number> = {};
        for (const c of CLASSES) {
          const h = n(`h${c}`)!;
          if (Math.abs(h - c / Math.PI) > 0.005) courseHeightIn[c.toFixed(1)] = h;
        }
        const wall: WallSettings = {
          postWidthIn: n('post')!, tenonIn: n('tenon')!, exteriorHeightIn: n('ext')!, interiorHeightIn: n('int')!,
          toleranceBelowIn: n('below')!, toleranceAboveIn: n('above')!, courseHeightIn,
          exteriorWalls: w.exteriorWalls.map((x, i) => ({ ...x, centerlineIn: n(`wall${i}`)!, hasLogs: logs[i] })),
          interiorPiecesIn: pieces as number[],
        };
        await app.run((recs) => app.actions.editWalls(wall, recs));
        onClose();
      }}>Save walls</Button>
    </Sheet>
  );
}

export function WallPlan() {
  const app = useApp();
  const d = app.derived;
  const plan = d.plan;
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState<number[] | null>(null);
  const [cands, setCands] = useState<Compared[] | null>(null);
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState<{ side: Side; text: string } | null>(null);
  const [walls, setWalls] = useState(false);
  const [msg, setMsg] = useState('');
  const allowedNow = allowed ?? supplyableClasses(d.logs, app.rec, CLASSES);

  const build = (sides: { side: Side; courses?: number[] }[]) => {
    setWorking(true);
    setTimeout(() => {
      const out: Compared[] = [];
      for (const { side, courses } of sides) {
        const list: CandidatePlan[] = courses
          ? [{ side, courses, heightIn: stackHeight(courses, plan.wall), diffIn: stackHeight(courses, plan.wall) - (side === 'exterior' ? plan.wall.exteriorHeightIn : plan.wall.interiorHeightIn),
              rows: side === 'exterior' ? generateRows(courses, [], plan.wall) : generateRows([], courses, plan.wall) }]
          : candidatePlans(side, allowedNow, plan);
        for (const c of list) out.push({ ...c, cmp: comparePlan(plan, c, { logs: d.logs, trees: d.trees, s: d.settings }) });
      }
      setCands(out);
      setWorking(false);
    }, 30);
  };

  const prev = [...d.plans].reverse().find((p) => p.version < plan.version);
  return (
    <Screen title="Wall plan">
      <p class="muted-line">Version {plan.version}{plan.note ? ` · ${plan.note}` : ''}. The logs needed list is built from these courses.</p>
      <CoursesCard plan={plan} side="exterior" />
      <CoursesCard plan={plan} side="interior" />

      <h2>Supply</h2>
      <Button wide onClick={() => setChecked(true)}>Check supply</Button>
      {checked && (app.shortfall.length
        ? app.shortfall.map((s) => <Banner key={s.kind} title="Shortfall found">{s.evidence}</Banner>)
        : <p class="card raised label" role="status">No shortfall found. {app.rec?.treesNeeded != null ? `About ${app.rec.treesNeeded} more trees should finish the list.` : 'The estimate cannot finish the list with trees up to the largest size in Settings.'}</p>)}

      <h2>Alternative plans</h2>
      <p class="muted-line secondary">Choose which circumferences the trees can supply. Plans use only these, largest at the bottom.</p>
      {CLASSES.map((c) => (
        <label key={c} class="check">
          <input type="checkbox" checked={allowedNow.includes(c)}
            onChange={(e) => setAllowed(((e.target as HTMLInputElement).checked ? [...allowedNow, c] : allowedNow.filter((x) => x !== c)).sort((a, b) => b - a))} />
          {c.toFixed(1)} in around
        </label>
      ))}
      <Button wide disabled={working || allowedNow.length === 0} onClick={() => build([{ side: 'exterior' }, { side: 'interior' }])}>
        {working ? 'Working…' : 'Build alternative plans'}
      </Button>
      {cands && cands.length === 0 && <p class="card raised">No plan with these circumferences stacks to the target height within the allowed range.</p>}
      {cands?.map((c, i) => (
        <CandidateCard key={`${c.side}-${c.courses.join()}`} c={c}
          onDismiss={() => setCands(cands.filter((_, j) => j !== i))}
          onEdit={() => setEditing({ side: c.side, text: c.courses.join(', ') })}
          onAccept={async () => {
            await app.run((recs) => app.actions.acceptPlan(c, recs));
            setCands(null);
            setMsg(`Now using version ${plan.version + 1}.`);
          }} />
      ))}
      {msg && <p class="label" role="status">{msg}</p>}

      <h2>Versions</h2>
      <div class="list">
        {d.plans.map((p) => (
          <div key={p.id} class="list-row raised"><span class="row-main"><span class="row-title">Version {p.version}{p.id === plan.id ? ' (in use)' : ''}</span>
            <span class="row-detail secondary">{p.note}{p.createdAt ? ` · ${dateText(p.createdAt)}` : ''}</span></span></div>
        ))}
      </div>
      <div class="stack" style={{ marginTop: '12px' }}>
        <Button wide disabled={!prev} onClick={async () => {
          await app.run((recs) => app.actions.undoPlan(recs));
          setMsg(prev ? `Back to version ${prev.version}.` : '');
        }}>Undo: go back to version {prev?.version ?? '—'}</Button>
        <Button wide onClick={() => setWalls(true)}>Edit walls</Button>
      </div>

      {editing && (
        <Sheet open title="Edit courses" onClose={() => setEditing(null)}>
          <div class="field">
            <label for="ec">{editing.side === 'exterior' ? 'Exterior' : 'Interior'} courses, bottom to top (in around, separated by commas)</label>
            <input id="ec" class="inset" value={editing.text} onInput={(e) => setEditing({ ...editing, text: (e.target as HTMLInputElement).value })} />
          </div>
          <Button variant="primary" wide onClick={() => {
            const courses = editing.text.split(/[ ,]+/).filter(Boolean).map(parseNumber);
            if (!courses.length || courses.some((c) => c === null || c <= 0)) return;
            build([{ side: editing.side, courses: courses as number[] }]);
            setEditing(null);
          }}>Compare this plan</Button>
        </Sheet>
      )}
      {walls && <WallEditor plan={plan} onClose={() => setWalls(false)} />}
    </Screen>
  );
}
