import { useState } from 'preact/hooks';
import { useApp } from '../../store/app-state';
import { Button, ListRow, Screen, Toast } from '../components';
import { fmtIn, sizeLabel } from '../format';

const rowText = (key: string) => {
  const [len, circ] = key.split('|');
  return sizeLabel(Number(len), Number(circ));
};
import { navigate } from '../router';

export function CutPlan({ treeId, isNew }: { treeId: string; isNew: boolean }) {
  const app = useApp();
  const tree = app.records.find((r) => r.id === treeId && r.type === 'tree');
  const undoMs = app.derived.settings.undoSeconds * 1000;
  // Only offer Undo within its window, even if Back returns to this screen later.
  const [undoLeft] = useState(() => (isNew && tree && tree.type === 'tree' ? undoMs - (Date.now() - tree.createdAt) : 0));
  const [toast, setToast] = useState(undoLeft > 0);
  if (!tree || tree.type !== 'tree' || tree.deleted)
    return (
      <Screen title="Cut plan">
        <p>This tree was removed.</p>
        <Button onClick={() => navigate('/')}>Back to main screen</Button>
      </Screen>
    );
  const { cuts, leftover } = tree.plan;
  return (
    <Screen title="Cut plan">
      <p class="muted-line">Cut these lengths, in order from the butt. Positions are measured from the butt end.</p>
      {cuts.length === 0 ? (
        <p class="card raised label">No needed logs fit this tree. It is still saved and helps the recommendations.</p>
      ) : (
        <ol class="list" style={{ padding: 0, listStyle: 'none' }}>
          {cuts.map((c, i) => (
            <li key={i}>
              <ListRow
                title={`${i + 1}. ${c.lengthFt} ft log`}
                detail={`${(c.startIn / 12).toFixed(2)}–${(c.endIn / 12).toFixed(2)} ft from butt · small end ${fmtIn(c.smallCirc)} around · fills the ${rowText(c.rowKey)} row`}
              />
            </li>
          ))}
        </ol>
      )}
      <p class="muted-line secondary">
        Left at the top: {(leftover.lengthIn / 12).toFixed(1)} ft, starting {(leftover.startIn / 12).toFixed(2)} ft from the butt.
      </p>
      <div class="stack">
        <Button variant="primary" wide onClick={() => navigate('/')}>Done</Button>
        <Button wide onClick={() => navigate(`/cut?tree=${tree.id}`)}>Edit these logs</Button>
      </div>
      {toast && (
        <Toast message="Tree saved." actionLabel="Undo" timeoutMs={undoLeft}
          onClose={() => setToast(false)}
          onAction={async () => {
            await app.run((recs) => app.actions.undoSubmit(tree.id, recs));
            navigate('/');
          }} />
      )}
    </Screen>
  );
}
