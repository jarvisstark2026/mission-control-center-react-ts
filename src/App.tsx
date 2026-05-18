import { Shell } from './features/shell/Shell';
import './styles/app.css';

export default function App() {
  const panelKind = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('panel');

  return (
    <main className="app-shell">
      <Shell panelKind={panelKind} />
    </main>
  );
}
