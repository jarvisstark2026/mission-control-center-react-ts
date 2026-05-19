import { Shell } from './features/shell/Shell';
import { isShellRole } from './features/shell/roles';
import './styles/app.css';

export default function App() {
  const searchParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
  const panelKind = searchParams?.get('panel');
  const roleParam = searchParams?.get('role');
  const role = roleParam && isShellRole(roleParam) ? roleParam : undefined;

  return (
    <main className="app-shell">
      <Shell panelKind={panelKind} role={role} />
    </main>
  );
}
