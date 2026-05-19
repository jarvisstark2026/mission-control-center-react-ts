import { useEffect, useState } from 'react';

import { Shell } from './features/shell/Shell';
import { isShellPanelAccessible } from './features/shell/nav';
import {
  getCanonicalShellLocationHref as buildShellLocationHref,
  readShellLocationFromSearch,
  type ShellLocationState,
} from './features/shell/location';
import type { ShellRole } from './features/shell/roles';
import type { WorkspaceWidget } from './features/workspace/workspaceTypes';
import { isWorkspaceWidgetKind } from './features/workspace/workspaceTypes';
import './styles/app.css';

const defaultShellRole: ShellRole = 'support';

function readShellLocation(): ShellLocationState {
  if (typeof window === 'undefined') {
    return { panelKind: null, role: defaultShellRole };
  }

  const { panelKind, role } = readShellLocationFromSearch(window.location.search, defaultShellRole);

  return {
    panelKind: panelKind && isWorkspaceWidgetKind(panelKind) && isShellPanelAccessible(role, panelKind) ? panelKind : null,
    role,
  };
}

function getCanonicalHref(locationState: ShellLocationState) {
  if (typeof window === 'undefined') {
    return '';
  }

  return buildShellLocationHref(window.location.href, locationState);
}

export default function App() {
  const [shellLocation, setShellLocation] = useState(readShellLocation);

  useEffect(() => {
    const syncShellLocation = () => setShellLocation(readShellLocation());

    window.addEventListener('popstate', syncShellLocation);
    return () => window.removeEventListener('popstate', syncShellLocation);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const canonicalHref = getCanonicalHref(shellLocation);
    if (canonicalHref && canonicalHref !== window.location.href) {
      window.history.replaceState({}, '', canonicalHref);
    }
  }, [shellLocation]);

  const handleNavigate = (nextLocation: { panelKind: WorkspaceWidget['kind'] | null; role: ShellRole }) => {
    if (typeof window === 'undefined') return;

    const url = new URL(buildShellLocationHref(window.location.href, nextLocation));

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
