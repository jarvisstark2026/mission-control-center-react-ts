import { useEffect, useState } from 'react';

import { Shell } from './features/shell/Shell';
import { isShellPanelAccessible } from './features/shell/nav';
import { isShellRole, type ShellRole } from './features/shell/roles';
import { isWorkspaceWidgetKind } from './features/workspace/workspaceTypes';
import './styles/app.css';

const defaultShellRole: ShellRole = 'support';

type ShellLocationState = {
  panelKind: string | null;
  role: ShellRole;
};

function readShellLocation(): ShellLocationState {
  if (typeof window === 'undefined') {
    return { panelKind: null, role: defaultShellRole };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const panelKind = searchParams.get('panel');
  const roleParam = searchParams.get('role');
  const role = roleParam && isShellRole(roleParam) ? roleParam : defaultShellRole;

  return {
    panelKind: panelKind && isWorkspaceWidgetKind(panelKind) && isShellPanelAccessible(role, panelKind) ? panelKind : null,
    role,
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
