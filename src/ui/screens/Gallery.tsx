import { useState } from 'preact/hooks';
import { Banner, Button, ListRow, NumberField, Pill, Progress, Screen, Sheet, Tile, Toast } from '../components';

/** Every component in every state, for checking the look on a real phone (#/dev/components). Sample values only. */
export function Gallery() {
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(false);
  return (
    <Screen title="Components (samples)">
      <div class="tiles">
        <Tile value="37.7 in" caption="around at waist height" />
        <Tile value="34.6 in" caption="around at waist height" />
        <Tile value="Working…" caption="around at waist height" />
      </div>
      <div class="row-buttons">
        <Button>Raised</Button>
        <Button disabled>Disabled</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="primary" disabled>Primary off</Button>
      </div>
      <h2>Fields</h2>
      <NumberField id="g1" label="Empty field (in)" value="" onInput={() => {}} />
      <NumberField id="g2" label="Filled field (in)" value="34.6" onInput={() => {}} />
      <NumberField id="g3" label="Field with error (in)" value="" error="Enter the circumference at 6 ft." onInput={() => {}} />
      <NumberField id="g4" label="Field with warning (in)" value="90" warning="A circumference is outside 5 to 80 in." onInput={() => {}} />
      <h2>Rows</h2>
      <div class="list">
        <ListRow title="16 ft · 28.3 in around" detail="need 8 · have 3 · to cut 5" onEdit={() => setSheet(true)} />
        <ListRow title="4 ft · 12.6 in around" detail="need 10 · have 10 · to cut 0" done />
        <ListRow title="16 ft · 30.1 in around" tag="from tree" />
      </div>
      <h2>Status</h2>
      <div class="row-buttons">
        <Pill>Last sync: 2 h ago</Pill>
        <Pill tone="neutral">Not synced yet</Pill>
      </div>
      <Progress value={40} max={138} label="40 of 138 logs done" />
      <Banner title="Sample warning" actionLabel="Review wall plan" onAction={() => {}}>
        Sample evidence text.
      </Banner>
      <div class="row-buttons">
        <Button onClick={() => setSheet(true)}>Open sheet</Button>
        <Button onClick={() => setToast(true)}>Show toast</Button>
      </div>
      <Sheet open={sheet} title="Edit sample" onClose={() => setSheet(false)}>
        <p>Sheet content.</p>
        <Button variant="primary" wide onClick={() => setSheet(false)}>Save</Button>
      </Sheet>
      {toast && <Toast message="Tree saved." actionLabel="Undo" onAction={() => {}} timeoutMs={10000} onClose={() => setToast(false)} />}
    </Screen>
  );
}
