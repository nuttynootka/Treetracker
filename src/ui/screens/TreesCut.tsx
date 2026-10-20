import { useState } from 'preact/hooks';
import { readingStations } from '../../core/profile';
import type { Tree } from '../../core/types';
import { useApp } from '../../store/app-state';
import { Button, Screen } from '../components';
import { dateText, fmtIn } from '../format';
import { navigate } from '../router';
import { EditTreeSheet } from './edit';

function TreeCard({ t, onEdit }: { t: Tree; onEdit: () => void }) {
  const stations = readingStations(t.lengthFt);
  const errs = t.predicted
    ? t.readings.flatMap((r, i) => (t.predicted!.readings[i] !== undefined ? [Math.abs(t.predicted!.readings[i] - r)] : []))
    : [];
  return (
    <div class="card raised">
      <div class="row-buttons" style={{ justifyContent: 'space-between' }}>
        <strong>{dateText(t.createdAt)}</strong>
        <span class="label">{fmtIn(t.waistCirc)} around at waist height (estimated)</span>
      </div>
      <p class="muted-line">Length cut {t.lengthFt} ft · butt {fmtIn(t.buttCirc)}</p>
      <p class="muted-line secondary">{stations.map((x, i) => `${x} ft: ${t.readings[i]?.toFixed(1) ?? '—'}`).join(' · ')}</p>
      <p class="muted-line">Plan: {t.plan.cuts.length ? t.plan.cuts.map((c) => `${c.lengthFt} ft (${c.smallCirc.toFixed(1)} in)`).join(', ') : 'no needed logs fit'}</p>
      {t.predicted && errs.length > 0 && (
        <p class="muted-line secondary">
          Model expected: {stations.map((x, i) => (t.predicted!.readings[i] !== undefined ? `${x} ft ${t.predicted!.readings[i].toFixed(1)}` : null)).filter(Boolean).join(' · ')}.
          {' '}Average difference {(errs.reduce((a, e) => a + e, 0) / errs.length).toFixed(1)} in.
        </p>
      )}
      {t.notes && <p class="muted-line">Notes: {t.notes}</p>}
      <div class="row-buttons">
        <Button onClick={onEdit}>Edit or delete</Button>
        <Button onClick={() => navigate(`/plan/${t.id}`)}>Show cut plan</Button>
      </div>
    </div>
  );
}

export function TreesCut() {
  const app = useApp();
  const [editing, setEditing] = useState<Tree | null>(null);
  const trees = app.derived.trees;
  return (
    <Screen title="Trees cut">
      <p class="muted-line">{trees.length} trees measured.</p>
      {trees.length === 0 && <p class="secondary">No trees yet. Add one on the main screen.</p>}
      {trees.map((t) => <TreeCard key={t.id} t={t} onEdit={() => setEditing(t)} />)}
      {editing && <EditTreeSheet tree={editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}
