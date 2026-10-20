import { render } from 'preact';
import '@fontsource/antonio/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/600.css';
import './theme.css';
import { AppStateProvider } from '../store/app-state';
import { parseRoute, useRoute } from './router';
import { Gallery } from './screens/Gallery';

function App() {
  const route = useRoute();
  const { parts } = parseRoute(route);
  if (parts[0] === 'dev') return <Gallery />;
  return <h1>TreeTracker</h1>;
}

render(
  <AppStateProvider fallback={<p class="screen">Opening TreeTracker…</p>}>
    <App />
  </AppStateProvider>,
  document.getElementById('app')!,
);
