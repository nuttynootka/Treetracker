import { useState } from 'preact/hooks';
import { Button, Sheet } from '../components';

/** Ask for a plan name, then save. */
export function NameSheet({ title, initial, saveLabel, onSave, onClose }: {
  title: string;
  initial: string;
  saveLabel: string;
  onSave: (name: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open title={title} onClose={onClose}>
      <div class="field">
        <label for="plan-name">Plan name</label>
        <input id="plan-name" class="inset" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </div>
      <Button variant="primary" wide disabled={busy || !name.trim()} onClick={async () => {
        setBusy(true);
        await onSave(name.trim());
        setBusy(false);
        onClose();
      }}>{saveLabel}</Button>
    </Sheet>
  );
}
