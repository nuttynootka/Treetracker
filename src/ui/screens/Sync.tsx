import { useState } from 'preact/hooks';
import { buildExport, SyncError, syncFileName } from '../../core/sync';
import { useApp } from '../../store/app-state';
import { getDevice, getSyncTimes, setSyncTimes } from '../../store/local';
import { pickTextFile, shareFile } from '../../platform/share';
import { Banner, Button, Screen } from '../components';
import { ago } from '../format';

export function Sync() {
  const app = useApp();
  const [times, setTimes] = useState(getSyncTimes());
  const [msg, setMsg] = useState('');
  const [planChanged, setPlanChanged] = useState(false);
  const days = times.lastExport ? Math.floor((Date.now() - times.lastExport) / 86_400_000) : null;
  return (
    <Screen title="Sync">
      <p class="muted-line">Export on one phone, import that file on the other. Then do the same the other way, so both phones match.</p>
      <div class="stack">
        <Button variant="primary" wide onClick={async () => {
          const dev = getDevice();
          const now = Date.now();
          await shareFile(syncFileName(dev.name, now), 'application/json', JSON.stringify(buildExport(app.records, dev, now)));
          setSyncTimes({ lastExport: now });
          setTimes(getSyncTimes());
          setMsg('Sync file created. Send it to the other phone.');
        }}>Export sync file</Button>
        <Button wide onClick={async () => {
          const text = await pickTextFile();
          if (text === null) return;
          try {
            const r = await app.importText(text);
            setPlanChanged(r.activePlanChanged);
            setMsg(`Imported: ${r.added} added, ${r.updated} updated, ${r.deleted} deleted.`);
            setTimes(getSyncTimes());
          } catch (e) {
            setMsg(e instanceof SyncError ? e.message : `Import failed: ${String(e)}`);
          }
        }}>Import sync file</Button>
      </div>
      {msg && <p class="label card raised" role="status" data-testid="sync-msg">{msg}</p>}
      {planChanged && <Banner title="Wall plan changed">The wall plan was changed on the other phone. Logs needed has been updated.</Banner>}
      <div class="card raised">
        <p class="muted-line">Last export: {ago(times.lastExport)}</p>
        <p class="muted-line">Last import: {ago(times.lastImport)}{times.lastImportSummary ? ` (${times.lastImportSummary})` : ''}</p>
        <p class="muted-line secondary">
          Exporting is also your backup. {days === null ? 'You have not exported yet.' : `Last backup ${days} day${days === 1 ? '' : 's'} ago.`} Uninstalling the app or clearing its storage erases everything that is not in a sync file.
        </p>
      </div>
    </Screen>
  );
}
