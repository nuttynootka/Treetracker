import { useRef, useState } from 'preact/hooks';
import { parseNumber } from '../../core/num';
import { readingStations, validateTree } from '../../core/profile';
import { useApp } from '../../store/app-state';
import { getSyncTimes } from '../../store/local';
import { Banner, Button, NumberField, Pill, Tile } from '../components';
import { ago, fmtIn } from '../format';
import { navigate } from '../router';

const NAV: [string, string][] = [
  ['Add logs', '/add-logs'], ['Logs needed', '/needed'], ['Logs cut', '/cut'], ['Trees cut', '/trees'],
  ['Reports', '/reports'], ['Wall plan', '/wall'], ['Settings', '/settings'], ['Sync', '/sync'],
];

const keyText = (key: string) => {
  const [len, circ] = key.split('|');
  return `${len} ft logs ${circ} in around`;
};

export function Main() {
  const app = useApp();
  const s = app.derived.settings;
  const [len, setLen] = useState('');
  const [butt, setButt] = useState('');
  const [readings, setReadings] = useState<Record<number, string>>({});
  const [tried, setTried] = useState(false);
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const lengthFt = parseNumber(len);
  const stations = lengthFt && lengthFt > 0 ? readingStations(lengthFt) : [];
  const vals = stations.map((x) => parseNumber(readings[x] ?? ''));
  const v = validateTree(lengthFt, parseNumber(butt), vals, s.topCirc);
  const order = ['len', 'butt', ...stations.map((x) => `r${x}`)];
  const focusNext = (id: string) => refs.current[order[order.indexOf(id) + 1]]?.focus();
  const rec = app.rec;
  const sync = getSyncTimes();
  const lastSync = Math.max(sync.lastExport ?? 0, sync.lastImport ?? 0);

  const submit = async () => {
    setTried(true);
    if (v.errors.length || (v.warnings.length && !override) || saving) return;
    setSaving(true);
    let treeId = '';
    const ok = await app.run((recs) => {
      const { tree, logs } = app.actions.submitTree(
        { lengthFt: lengthFt!, buttCirc: parseNumber(butt)!, readings: vals as number[], warningsOverridden: v.warnings.length > 0 },
        recs,
      );
      treeId = tree.id;
      return [tree, ...logs];
    });
    if (!ok) {
      setSaving(false);
      return;
    }
    setLen(''); setButt(''); setReadings({}); setTried(false); setOverride(false); setSaving(false);
    navigate(`/plan/${treeId}?new=1`);
  };

  return (
    <main class="screen">
      <div class="row-buttons" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span class="label secondary">TreeTracker</span>
        <Pill tone={lastSync ? 'blue' : 'neutral'}>{lastSync ? `Last sync: ${ago(lastSync)}` : 'Not synced yet'}</Pill>
      </div>
      <h1>Next 3 trees to cut</h1>
      <div class="tiles" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <Tile key={i} value={app.busy && !rec ? '…' : rec?.next[i] !== undefined ? fmtIn(rec.next[i]) : '—'} caption={app.busy && !rec ? 'working it out' : 'around at waist height'} />
        ))}
      </div>
      <p class="muted-line" data-testid="trees-needed">
        {!rec ? 'Working out how many trees are still needed…'
          : rec.treesNeeded !== null ? `About ${rec.treesNeeded} more trees (+${rec.spare} spare)`
          : `Cannot finish with trees up to ${s.maxWaistCirc.toFixed(1)} in around: ${rec.unfillable.map(keyText).join('; ')}`}
      </p>
      {app.shortfall.map((sig) => (
        <Banner key={sig.kind} title={sig.kind === 'unfillable' ? 'Some logs may not be available' : 'Fewer large logs than expected'}
          actionLabel="Review wall plan" onAction={() => navigate('/wall')}>{sig.evidence}</Banner>
      ))}

      <h2>Add a tree you cut</h2>
      <form class="card raised-lg" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <NumberField id="len" label="Tree length cut (ft)" value={len} onInput={setLen}
          inputRef={(el) => { refs.current.len = el; }} onEnter={() => focusNext('len')}
          error={tried && lengthFt === null ? 'Enter the tree length cut, in feet.' : null} />
        <NumberField id="butt" label="Circumference at butt (in)" value={butt} onInput={setButt}
          inputRef={(el) => { refs.current.butt = el; }} onEnter={() => focusNext('butt')}
          enterKeyHint={stations.length ? 'next' : 'done'}
          error={tried && parseNumber(butt) === null ? 'Enter the circumference at the butt, in inches.' : null} />
        {stations.map((x, i) => (
          <NumberField key={x} id={`r${x}`} label={`Circumference at ${x} ft (in)`} value={readings[x] ?? ''}
            onInput={(val) => setReadings((r) => ({ ...r, [x]: val }))}
            inputRef={(el) => { refs.current[`r${x}`] = el; }}
            enterKeyHint={i === stations.length - 1 ? 'done' : 'next'}
            onEnter={() => (i === stations.length - 1 ? submit() : focusNext(`r${x}`))}
            error={tried && vals[i] === null ? `Enter the circumference at ${x} ft.` : null} />
        ))}
        {v.warnings.length > 0 && vals.every((x) => x !== null) && (
          <div class="stack">
            {v.warnings.map((w) => <p key={w} class="msg msg-warn">{w}</p>)}
            <label class="check"><input type="checkbox" checked={override} onChange={(e) => setOverride((e.target as HTMLInputElement).checked)} />Ignore warnings, the numbers are right</label>
          </div>
        )}
        <Button type="submit" variant="primary" wide disabled={saving || (tried && v.errors.length > 0) || (v.warnings.length > 0 && !override)}>
          {saving ? 'Saving…' : 'Submit tree'}
        </Button>
      </form>

      <nav class="grid-buttons" aria-label="Screens">
        {NAV.map(([label, path]) => <Button key={path} onClick={() => navigate(path)}>{label}</Button>)}
      </nav>
    </main>
  );
}
