import { useState } from 'preact/hooks';
import { parseNumber } from '../../core/num';
import { readingStations, validateTree } from '../../core/profile';
import type { LogCut, NeedRow, Tree } from '../../core/types';
import { useApp } from '../../store/app-state';
import { Button, NumberField, Sheet } from '../components';

function DeleteButton({ what, onConfirm }: { what: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  return asking ? (
    <div class="stack">
      <p class="label">Delete {what}?</p>
      <div class="row-buttons">
        <Button onClick={onConfirm}>Yes, delete</Button>
        <Button onClick={() => setAsking(false)}>Keep it</Button>
      </div>
    </div>
  ) : (
    <Button onClick={() => setAsking(true)}>Delete…</Button>
  );
}

export function EditLogSheet({ log, onClose }: { log: LogCut; onClose: () => void }) {
  const app = useApp();
  const [len, setLen] = useState(String(log.lengthFt));
  const [circ, setCirc] = useState(String(log.smallCirc));
  const [qty, setQty] = useState(String(log.quantity));
  const l = parseNumber(len), c = parseNumber(circ), q = parseNumber(qty);
  const ok = l !== null && l > 0 && c !== null && c > 0 && q !== null && q >= 1;
  return (
    <Sheet open title="Edit log" onClose={onClose}>
      <NumberField id="el-len" label="Length (ft, rounded up)" value={len} onInput={setLen} />
      <NumberField id="el-circ" label="Circumference at small end (in)" value={circ} onInput={setCirc} />
      <NumberField id="el-qty" label="Quantity" value={qty} onInput={setQty} enterKeyHint="done" />
      <div class="stack">
        <Button variant="primary" wide disabled={!ok} onClick={async () => {
          await app.run((recs) => app.actions.updateRecord(log, { lengthFt: l!, smallCirc: c!, quantity: Math.round(q!) }, recs));
          onClose();
        }}>Save log</Button>
        <DeleteButton what="this log" onConfirm={async () => {
          await app.run((recs) => app.actions.deleteRecord(log, recs));
          onClose();
        }} />
      </div>
    </Sheet>
  );
}

export function EditRowSheet({ row, onClose }: { row: NeedRow | null; onClose: () => void }) {
  const app = useApp();
  const [len, setLen] = useState(row ? String(row.lengthFt) : '');
  const [circ, setCirc] = useState(row ? String(row.minCirc) : '');
  const [qty, setQty] = useState(row ? String(row.quantity) : '');
  const l = parseNumber(len), c = parseNumber(circ), q = parseNumber(qty);
  const ok = l !== null && l > 0 && c !== null && c > 0 && q !== null && q >= 0;
  return (
    <Sheet open title={row ? 'Edit needed row' : 'Add needed row'} onClose={onClose}>
      <NumberField id="er-len" label="Length (ft, rounded up)" value={len} onInput={setLen} />
      <NumberField id="er-circ" label="Smallest circumference at small end (in)" value={circ} onInput={setCirc} />
      <NumberField id="er-qty" label="Quantity needed" value={qty} onInput={setQty} enterKeyHint="done" />
      <div class="stack">
        <Button variant="primary" wide disabled={!ok} onClick={async () => {
          await app.run((recs) =>
            row
              ? app.actions.updateRecord(row, { lengthFt: Math.ceil(l! - 1e-9), minCirc: c!, quantity: Math.round(q!) }, recs)
              : app.actions.addNeedRow({ lengthFt: l!, minCirc: c!, quantity: Math.round(q!) }),
          );
          onClose();
        }}>{row ? 'Save row' : 'Add row'}</Button>
        {row && <DeleteButton what="this row" onConfirm={async () => {
          await app.run((recs) => app.actions.deleteRecord(row, recs));
          onClose();
        }} />}
      </div>
    </Sheet>
  );
}

export function EditTreeSheet({ tree, onClose }: { tree: Tree; onClose: () => void }) {
  const app = useApp();
  const s = app.derived.settings;
  const [len, setLen] = useState(String(tree.lengthFt));
  const [butt, setButt] = useState(String(tree.buttCirc));
  const [readings, setReadings] = useState<string[]>(tree.readings.map(String));
  const [notes, setNotes] = useState(tree.notes);
  const lengthFt = parseNumber(len);
  const stations = lengthFt && lengthFt > 0 ? readingStations(lengthFt) : [];
  const vals = stations.map((_, i) => parseNumber(readings[i] ?? ''));
  const v = validateTree(lengthFt, parseNumber(butt), vals, s.topCirc);
  const logCount = app.derived.logs.filter((l) => l.treeId === tree.id).length;
  return (
    <Sheet open title="Edit tree" onClose={onClose}>
      <p class="secondary muted-line">Changing measurements updates the averages. The logs already recorded stay as they are; edit them on Logs cut.</p>
      <NumberField id="et-len" label="Tree length cut (ft)" value={len} onInput={setLen} />
      <NumberField id="et-butt" label="Circumference at butt (in)" value={butt} onInput={setButt} />
      {stations.map((x, i) => (
        <NumberField key={x} id={`et-r${x}`} label={`Circumference at ${x} ft (in)`} value={readings[i] ?? ''}
          onInput={(val) => setReadings((r) => { const n = [...r]; n[i] = val; return n; })} />
      ))}
      <div class="field">
        <label for="et-notes">Notes</label>
        <input id="et-notes" class="inset" value={notes} onInput={(e) => setNotes((e.target as HTMLInputElement).value)} />
      </div>
      {v.errors.map((e) => <p key={e} class="msg msg-error">{e}</p>)}
      {v.warnings.map((w) => <p key={w} class="msg msg-warn">{w}</p>)}
      <div class="stack">
        <Button variant="primary" wide disabled={v.errors.length > 0} onClick={async () => {
          await app.run((recs) => app.actions.updateRecord(tree, { lengthFt: lengthFt!, buttCirc: parseNumber(butt)!, readings: vals as number[], notes, warningsOverridden: v.warnings.length > 0 }, recs));
          onClose();
        }}>Save tree</Button>
        <DeleteButton what={`this tree and its ${logCount} logs`} onConfirm={async () => {
          await app.run((recs) => app.actions.deleteRecord(tree, recs));
          onClose();
        }} />
      </div>
    </Sheet>
  );
}
