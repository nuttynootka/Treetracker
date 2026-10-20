import { useState } from 'preact/hooks';
import { parseNumber } from '../../core/num';
import type { SettingsValues } from '../../core/types';
import { useApp } from '../../store/app-state';
import { getDevice, setDeviceName } from '../../store/local';
import { Button, NumberField, Screen } from '../components';

const FIELDS: [keyof SettingsValues, string][] = [
  ['kerfIn', 'Saw kerf (in)'],
  ['buttTrimIn', 'Butt trim (in)'],
  ['stumpHeightFt', 'Stump height (ft)'],
  ['waistHeightFt', 'Waist height (ft)'],
  ['maxWaistCirc', 'Largest waist circumference to recommend (in)'],
  ['topCirc', 'Circumference at the usable top (in)'],
  ['priorTaperPerFt', 'Starting taper guess (in of circumference per ft)'],
  ['shortfallMinTrees', 'Trees before the low-yield warning'],
  ['shortfallYieldRatio', 'Low-yield warning below this share (0 to 1)'],
  ['spareFraction', 'Spare trees allowance (0 to 1)'],
  ['undoSeconds', 'Seconds to undo a submitted tree'],
];

export function Settings() {
  const app = useApp();
  const s = app.derived.settings;
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map(([k]) => [k, String(s[k])])));
  const [name, setName] = useState(getDevice().name);
  const [msg, setMsg] = useState('');
  const parsed = FIELDS.map(([k]) => [k, parseNumber(vals[k] ?? '')] as const);
  const ok = parsed.every(([, v]) => v !== null && v >= 0);
  return (
    <Screen title="Settings">
      <form class="card raised-lg" onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setDeviceName(name.trim() || 'This phone');
        await app.run((recs) => app.actions.updateSettings(Object.fromEntries(parsed) as Partial<SettingsValues>, recs));
        setMsg('Saved. Recommendations are being updated.');
      }}>
        <div class="field">
          <label for="dev-name">This phone's name (shown in sync files)</label>
          <input id="dev-name" class="inset" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </div>
        {FIELDS.map(([k, label]) => (
          <NumberField key={k} id={`set-${k}`} label={label} value={vals[k] ?? ''}
            onInput={(v) => setVals((x) => ({ ...x, [k]: v }))}
            error={parseNumber(vals[k] ?? '') === null ? 'Enter a number.' : null} />
        ))}
        <Button type="submit" variant="primary" wide disabled={!ok}>Save settings</Button>
        {msg && <p class="label" role="status">{msg}</p>}
      </form>
      <p class="muted-line secondary">Wall measurements and course heights are on the Wall plan screen.</p>
      <p class="muted-line">Fonts: Antonio and DM Sans, under the SIL Open Font License. <a href="licenses/Antonio-OFL.txt">Antonio license</a> · <a href="licenses/DMSans-OFL.txt">DM Sans license</a></p>
    </Screen>
  );
}
