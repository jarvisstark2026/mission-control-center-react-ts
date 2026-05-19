import { useEffect, useState } from 'react';

import { Workspace } from '../workspace/Workspace';
import type { WorkspaceWidget } from '../workspace/workspaceTypes';
import { getVisibleShellNavItems, isShellPanelAccessible } from './nav';
import { shellScopes, type ShellRole } from './roles';
import './shell.css';

const defaultRole: ShellRole = 'support';
const railBreakpoint = 900;

type ShellProps = {
  panelKind?: string | null;
  role?: ShellRole;
  onNavigate: (nextLocation: { panelKind: string | null; role: ShellRole }) => void;
};

function getPanelLabel(panelKind: string | null | undefined) {
  switch (panelKind) {
    case 'overview':
      return 'Command core';
    case 'graph':
      return 'Telemetry';
    case 'audio':
      return 'Audio preview';
    case 'map':
      return 'Map / routes';
    case 'diagram':
      return 'Diagram preview';
    case 'project':
      return 'Project list';
    case 'news':
      return 'News / market';
    case 'schedule':
      return 'Schedule';
    case 'launcher':
      return 'App launcher';
    case 'browser':
      return 'Browser';
    case 'watch-video':
      return 'Video preview';
    case 'image':
      return 'Image preview';
    case 'pdf':
      return 'PDF';
    case 'file-explorer':
      return 'File explorer';
    case 'native-app':
      return 'Native app bridge';
    case 'window-manager':
      return 'Window manager';
    case 'sheet':
      return 'Spreadsheet';
    case 'docs':
      return 'Docs';
    case 'slides':
      return 'Presentation';
    case 'trading-graph':
      return 'Trading graph';
    case 'video':
      return 'Video preview';
    case '3d':
      return '3D model preview';
    case '3d-studio':
      return '3D studio';
    case 'flow':
      return 'Chat preview';
    case 'list':
      return 'List';
    default:
      return 'Window';
  }
}

function normalizePanelKind(panelKind: string | null | undefined): WorkspaceWidget['kind'] | null {
  switch (panelKind) {
    case 'overview':
    case 'graph':
    case 'audio':
    case 'map':
    case 'diagram':
    case 'project':
    case 'news':
    case 'schedule':
    case 'launcher':
    case 'browser':
    case 'watch-video':
    case 'pdf':
    case 'file-explorer':
    case 'native-app':
    case 'window-manager':
    case 'sheet':
    case 'docs':
    case 'slides':
    case 'trading-graph':
    case 'video':
    case '3d':
    case '3d-studio':
    case 'flow':
    case 'list':
      return panelKind;
    default:
      return null;
  }
}

const navPanelById: Record<string, WorkspaceWidget['kind'] | null> = {
  workspace: null,
  telemetry: 'graph',
  approvals: 'project',
  registry: 'window-manager',
  schedule: 'schedule',
  launcher: 'launcher',
  browser: 'browser',
  'watch-video': 'watch-video',
  audio: 'audio',
  diagram: 'diagram',
  project: 'project',
  video: 'video',
  '3d': '3d',
  list: 'list',
  'file-explorer': 'file-explorer',
  'native-app': 'native-app',
  'window-manager': 'window-manager',
  sheet: 'sheet',
  docs: 'docs',
  slides: 'slides',
  'trading-graph': 'trading-graph',
  image: 'image',
  pdf: 'pdf',
  '3d-studio': '3d-studio',
};

function getActiveNavId(panelKind: WorkspaceWidget['kind'] | null) {
  if (!panelKind) return 'workspace';

  const entry = Object.entries(navPanelById).find(([, mappedPanelKind]) => mappedPanelKind === panelKind);
  return entry?.[0] ?? 'workspace';
}

export function Shell({ panelKind = null, role = defaultRole, onNavigate }: ShellProps) {
  const activeRole = role ?? defaultRole;
  const visibleItems = getVisibleShellNavItems(activeRole);
  const activePanelKind = normalizePanelKind(panelKind);
  const activeNavId = getActiveNavId(activePanelKind);
  const canOpenPanel = isShellPanelAccessible(activeRole, activePanelKind);
  const isDetachedWindow = Boolean(activePanelKind && canOpenPanel);
  const [isRailOpen, setIsRailOpen] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;

    return !window.matchMedia(`(max-width: ${railBreakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia(`(max-width: ${railBreakpoint}px)`);
    const syncRailState = () => setIsRailOpen(!media.matches);

    syncRailState();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncRailState);
      return () => media.removeEventListener('change', syncRailState);
    }

    media.addListener(syncRailState);
    return () => media.removeListener(syncRailState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const media = window.matchMedia(`(max-width: ${railBreakpoint}px)`);
      if (!media.matches) return;

      setIsRailOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeRailOnMobile = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    if (window.matchMedia(`(max-width: ${railBreakpoint}px)`).matches) {
      setIsRailOpen(false);
    }
  };

  useEffect(() => {
    document.title = isDetachedWindow
      ? `Mission Control Center — ${getPanelLabel(activePanelKind)}`
      : `Mission Control Center — ${shellScopes.find((scope) => scope.id === activeRole)?.label ?? 'Support'}`;
  }, [activePanelKind, activeRole, isDetachedWindow]);

  const navigateToPanel = (target: WorkspaceWidget['kind'] | null) => {
    closeRailOnMobile();
    onNavigate({ panelKind: target, role: activeRole });
  };

  const navigateToRole = (targetRole: ShellRole) => {
    closeRailOnMobile();
    onNavigate({
      panelKind: activePanelKind && !isShellPanelAccessible(targetRole, activePanelKind) ? null : activePanelKind,
      role: targetRole,
    });
  };

  if (isDetachedWindow && activePanelKind) {
    return (
      <section className="shell-frame shell-frame-window" aria-label="Mission Control Center window">
        <div className="shell-window">
          <div className="shell-window-head">
            <div className="shell-branding shell-branding-window">
              <p className="shell-eyebrow">Mission Control Center</p>
              <h1>{getPanelLabel(activePanelKind)}</h1>
              <p className="shell-copy">
                Detached page mode. The OS window can go wherever the desktop gods permit; the app merely keeps its hands clean.
              </p>
            </div>

            <div className="shell-window-actions">
              <button type="button" className="shell-window-button" onClick={() => navigateToPanel(null)}>
                Open hub
              </button>
              <button
                type="button"
                className="shell-window-button is-muted"
                onClick={() => {
                  if (window.opener) {
                    window.close();
                    return;
                  }
                  navigateToPanel(null);
                }}
              >
                Close window
              </button>
            </div>
          </div>

          <Workspace panelKind={activePanelKind} />
        </div>
      </section>
    );
  }

  return (
    <section className="shell-frame" aria-label="Mission Control Center shell">
      <button
        type="button"
        className="shell-menu-toggle"
        aria-label={isRailOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-controls="shell-rail"
        aria-expanded={isRailOpen}
        onClick={() => setIsRailOpen((current) => !current)}
      >
        ☰
      </button>

      <div
        className={`shell-backdrop ${isRailOpen ? 'is-visible' : ''}`}
        aria-hidden="true"
        onClick={() => setIsRailOpen(false)}
      />

      <aside id="shell-rail" className={`shell-rail ${isRailOpen ? 'is-open' : 'is-closed'}`} aria-label="Role navigation">
        <div className="shell-branding">
          <p className="shell-eyebrow">Mission Control Center</p>
          <h1>Spatial command surface</h1>
          <p className="shell-copy">
            {shellScopes.find((scope) => scope.id === activeRole)?.description ?? 'Support'}
          </p>
        </div>

        <div className="shell-scope-group">
          <p className="shell-section-label">Scopes</p>
          <ul className="shell-scope-list">
            {shellScopes.map((scope) => (
              <li key={scope.id} className={scope.id === activeRole ? 'is-active' : undefined}>
                <button
                  type="button"
                  className={`shell-nav-button shell-scope-button ${scope.id === activeRole ? 'is-active' : ''}`}
                  aria-pressed={scope.id === activeRole}
                  onClick={() => navigateToRole(scope.id)}
                >
                  <span>{scope.label}</span>
                  <small>{scope.description}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="shell-nav-group">
          <p className="shell-section-label">Navigation</p>
          <ul className="shell-nav-list">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`shell-nav-button ${item.id === activeNavId ? 'is-active' : ''}`}
                  aria-current={item.id === activeNavId ? 'page' : undefined}
                  onClick={() => navigateToPanel(navPanelById[item.id] ?? null)}
                >
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="shell-workspace">
        <Workspace />
      </div>
    </section>
  );
}
