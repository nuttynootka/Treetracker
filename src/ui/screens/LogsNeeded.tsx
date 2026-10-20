import { useState } from 'preact/hooks';
import type { NeedRow } from '../../core/types';
import { useApp } from '../../store/app-state';
import { Button, ListRow, Progress, Screen } from '../components';
import { sizeLabel } from '../format';
import { EditRowSheet } from './edit';

export function LogsNeeded() {
  const app = useApp();
  const d = app.derived;
  const [editing, setEditing] = useState<NeedRow | null | 'new'>(null);
  const toCut = d.rowViews.reduce((a, v) => a + v.toCut, 0);
  return (
    <Screen title="Logs needed">
      <Progress value={d.totals.have} max={d.totals.needed} label={`${d.totals.have} of ${d.totals.needed} logs done · ${toCut} to cut`} />
      <p class="muted-line secondary">Wall plan version {d.plan.version}. Sizes are minimums: longer or larger around logs also count.</p>
      <div class="list" data-testid="needed-list">
        {d.rowViews.map((v) => (
          <ListRow key={v.row.id} done={v.done} title={sizeLabel(v.row.lengthFt, v.row.minCirc)}
            detail={`need ${v.row.quantity} · have ${v.have} · to cut ${v.toCut}${v.row.manuallyEdited ? ' · edited' : ''}`}
            onEdit={() => setEditing(v.row)} />
        ))}
      </div>
      <div class="stack" style={{ marginTop: '16px' }}>
        <Button wide onClick={() => setEditing('new')}>Add row</Button>
      </div>
      <h2>Extras</h2>
      <p class="muted-line secondary">Logs we have that no row needs. They are kept.</p>
      <div class="list">
        {d.extras.length === 0 && <p class="secondary">None.</p>}
        {d.extras.map((e) => <ListRow key={e.log.id} title={`${e.count} × ${sizeLabel(e.log.lengthFt, e.log.smallCirc)}`} tag={e.log.source === 'tree' ? 'from tree' : 'by hand'} />)}
      </div>
      {editing && <EditRowSheet row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}
