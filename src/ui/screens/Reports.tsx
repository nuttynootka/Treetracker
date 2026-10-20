import { reportCsv, reportText } from '../../core/report';
import type { ReportInput } from '../../core/report';
import { useApp } from '../../store/app-state';
import { shareFile, shareText } from '../../platform/share';
import { Button, Screen } from '../components';

export function Reports() {
  const app = useApp();
  const d = app.derived;
  const input: ReportInput = {
    rows: d.rowViews.map((v) => ({ lengthFt: v.row.lengthFt, minCirc: v.row.minCirc, needed: v.row.quantity, have: v.have, toCut: v.toCut })),
    logs: d.logs.map((l) => ({ lengthFt: l.lengthFt, smallCirc: l.smallCirc, quantity: l.quantity, source: l.source })),
    extras: d.extras.reduce((a, e) => a + e.count, 0),
    rec: app.rec,
    trees: d.trees,
    generatedAt: Date.now(),
    planVersion: d.plan.version,
  };
  const text = reportText(input);
  const stamp = new Date().toISOString().slice(0, 10);
  return (
    <Screen title="Reports">
      <div class="stack">
        <Button variant="primary" wide onClick={() => shareText('TreeTracker report', text)}>Share as text</Button>
        <Button wide onClick={() => shareFile(`treetracker-report-${stamp}.txt`, 'text/plain', text)}>Share as file (.txt)</Button>
        <Button wide onClick={() => shareFile(`treetracker-report-${stamp}.csv`, 'text/csv', reportCsv(input))}>Share as spreadsheet (.csv)</Button>
      </div>
      <pre class="mono-pre inset" style={{ marginTop: '16px' }} data-testid="report">{text}</pre>
    </Screen>
  );
}
