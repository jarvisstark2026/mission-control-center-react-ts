import { useEffect, useState } from 'react';

import { Shell } from './features/shell/Shell';
import { isShellRole, type ShellRole } from './features/shell/roles';
import './styles/app.css';

type ShellLocationState = {
  panelKind: string | null;
  role: ShellRole | undefined;
};

function readShellLocation(): ShellLocationState {
  if (typeof window === 'undefined') {
    return { panelKind: null, role: undefined };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const panelKind = searchParams.get('panel');
  const roleParam = searchParams.get('role');

  return {
    panelKind,
    role: roleParam && isShellRole(roleParam) ? roleParam : undefined,
  };
}

export default function App() {
  const [shellLocation, setShellLocation] = useState(readShellLocation);

  useEffect(() => {
    const syncShellLocation = () => setShellLocation(readShellLocation());

    window.addEventListener('popstate', syncShellLocation);
    return () => window.removeEventListener('popstate', syncShellLocation);
  }, []);

  const handleNavigate = (nextLocation: { panelKind: string | null; role: ShellRole }) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (nextLocation.panelKind) url.searchParams.set('panel', nextLocation.panelKind);
    else url.searchParams.delete('panel');

    url.searchParams.set('role', nextLocation.role);

    if (url.toString() !== window.location.href) {
      window.history.pushState({}, '', url);
    }

    setShellLocation({
      panelKind: nextLocation.panelKind,
      role: nextLocation.role,
    });
  };

  return (
    <main className="app-shell">
      <Shell panelKind={shellLocation.panelKind} role={shellLocation.role} onNavigate={handleNavigate} />
    </main>
  );
}
