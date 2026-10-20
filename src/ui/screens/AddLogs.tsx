import { useState } from 'preact/hooks';
import { parseNumber } from '../../core/num';
import type { LogCut } from '../../core/types';
import { useApp } from '../../store/app-state';
import { Button, ListRow, NumberField, Screen } from '../components';
import { sizeLabel } from '../format';
import { EditLogSheet } from './edit';

export function AddLogs() {
  const app = useApp();
  const [len, setLen] = useState('');
  const [circ, setCirc] = useState('');
  const [qty, setQty] = useState('1');
  const [editing, setEditing] = useState<LogCut | null>(null);
  const [msg, setMsg] = useState('');
  const l = parseNumber(len), c = parseNumber(circ), q = parseNumber(qty);
  const ok = l !== null && l > 0 && c !== null && c > 0 && q !== null && q >= 1;
  const recent = app.derived.logs.filter((x) => x.source === 'manual').slice(0, 10);
  return (
    <Screen title="Add logs">
      <p class="muted-line secondary">For logs cut before you used the app. These count toward logs needed but never change the tree recommendations.</p>
      <form class="card raised-lg" onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        await app.run(() => app.actions.addManualLog({ lengthFt: l!, smallCirc: c!, quantity: q! }));
        setMsg(`Added ${Math.round(q!)} × ${sizeLabel(Math.ceil(l! - 1e-9), c!)}.`);
        setLen(''); setCirc(''); setQty('1');
      }}>
        <NumberField id="al-len" label="Length (ft, rounded up)" value={len} onInput={setLen} />
        <NumberField id="al-circ" label="Circumference at small end (in)" value={circ} onInput={setCirc} />
        <NumberField id="al-qty" label="Quantity" value={qty} onInput={setQty} enterKeyHint="done" />
        <Button type="submit" variant="primary" wide disabled={!ok}>Add logs</Button>
        {msg && <p class="label" role="status">{msg}</p>}
      </form>
      <h2>Recently added by hand</h2>
      <div class="list">
        {recent.length === 0 && <p class="secondary">None yet.</p>}
        {recent.map((x) => <ListRow key={x.id} title={`${x.quantity} × ${sizeLabel(x.lengthFt, x.smallCirc)}`} tag="by hand" onEdit={() => setEditing(x)} />)}
      </div>
      {editing && <EditLogSheet log={editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}
