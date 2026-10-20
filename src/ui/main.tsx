import { render } from 'preact';
import '@fontsource/antonio/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/600.css';
import './theme.css';
import { AppStateProvider } from '../store/app-state';
import { parseRoute, useRoute } from './router';
import { Gallery } from './screens/Gallery';
import { Main } from './screens/Main';
import { CutPlan } from './screens/CutPlan';
import { AddLogs } from './screens/AddLogs';
import { LogsNeeded } from './screens/LogsNeeded';
import { LogsCut } from './screens/LogsCut';
import { TreesCut } from './screens/TreesCut';
import { Reports } from './screens/Reports';
import { Settings } from './screens/Settings';
import { Sync } from './screens/Sync';
import { WallPlan } from './screens/WallPlan';

function App() {
  const route = useRoute();
  const { parts, query } = parseRoute(route);
  switch (parts[0]) {
    case 'dev': return <Gallery />;
    case 'plan': return <CutPlan key={parts[1]} treeId={parts[1]} isNew={query.get('new') === '1'} />;
    case 'add-logs': return <AddLogs />;
    case 'needed': return <LogsNeeded />;
    case 'cut': return <LogsCut treeFilter={query.get('tree')} />;
    case 'trees': return <TreesCut />;
    case 'reports': return <Reports />;
    case 'settings': return <Settings />;
    case 'sync': return <Sync />;
    case 'wall': return <WallPlan />;
    default: return <Main />;
  }
}

render(
  <AppStateProvider fallback={<p class="screen">Opening TreeTracker…</p>}>
    <App />
  </AppStateProvider>,
  document.getElementById('app')!,
);
