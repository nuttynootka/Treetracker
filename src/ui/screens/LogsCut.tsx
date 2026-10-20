import { useState } from 'preact/hooks';
import type { LogCut } from '../../core/types';
import { useApp } from '../../store/app-state';
import { Button, ListRow, Screen } from '../components';
import { dateText, sizeLabel } from '../format';
import { navigate } from '../router';
import { EditLogSheet } from './edit';

export function LogsCut({ treeFilter }: { treeFilter: string | null }) {
  const app = useApp();
  const [editing, setEditing] = useState<LogCut | null>(null);
  const logs = app.derived.logs.filter((l) => !treeFilter || l.treeId === treeFilter);
  const total = logs.reduce((a, l) => a + l.quantity, 0);
  return (
    <Screen title="Logs cut">
      <p class="muted-line">{total} logs{treeFilter ? ' from this tree' : ''}. Tap a log to fix it.</p>
      {treeFilter && <Button onClick={() => navigate('/cut')}>Show all logs</Button>}
      <div class="list" style={{ marginTop: '12px' }}>
        {logs.length === 0 && <p class="secondary">No logs yet.</p>}
        {logs.map((l) => (
          <ListRow key={l.id} title={`${l.quantity > 1 ? `${l.quantity} × ` : ''}${sizeLabel(l.lengthFt, l.smallCirc)}`}
            detail={dateText(l.createdAt)} tag={l.source === 'tree' ? 'from tree' : 'by hand'} onEdit={() => setEditing(l)} />
        ))}
      </div>
      {editing && <EditLogSheet log={editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}
