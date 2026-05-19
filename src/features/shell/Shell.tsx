import { useEffect } from 'react';

import { Workspace } from '../workspace/Workspace';
import type { WorkspaceWidget } from '../workspace/workspaceTypes';
import { getVisibleShellNavItems } from './nav';
import { shellScopes, type ShellRole } from './roles';
import './shell.css';

const defaultRole: ShellRole = 'support';

type ShellProps = {
  panelKind?: string | null;
  role?: ShellRole;
};

function getPanelLabel(panelKind: string | null | undefined) {
  switch (panelKind) {
    case 'overview':
      return 'Command core';
    case 'graph':
      return 'Telemetry';
    case 'audio':
      return 'Audio surface';
    case 'map':
      return 'Map / routes';
    case 'diagram':
      return 'Diagram';
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
      return 'Watch video';
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
      return 'Video';
    case '3d':
      return '3D preview';
    case 'flow':
      return 'Flow chart';
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
    case 'file-explorer':
    case 'native-app':
    case 'window-manager':
    case 'sheet':
    case 'docs':
    case 'slides':
    case 'trading-graph':
    case 'video':
    case '3d':
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
  'file-explorer': 'file-explorer',
  'native-app': 'native-app',
  'window-manager': 'window-manager',
  sheet: 'sheet',
  docs: 'docs',
  slides: 'slides',
  'trading-graph': 'trading-graph',
  image: 'image',
  pdf: 'pdf',
};

export function Shell({ panelKind = null, role = defaultRole }: ShellProps) {
  const activeRole = role ?? defaultRole;
  const visibleItems = getVisibleShellNavItems(activeRole);
  const activePanelKind = normalizePanelKind(panelKind);

  useEffect(() => {
    document.title = activePanelKind
      ? `Mission Control Center — ${getPanelLabel(activePanelKind)}`
      : `Mission Control Center — ${shellScopes.find((scope) => scope.id === activeRole)?.label ?? 'Support'}`;
  }, [activePanelKind, activeRole]);

  const navigateToPanel = (target: WorkspaceWidget['kind'] | null) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (target) url.searchParams.set('panel', target);
    else url.searchParams.delete('panel');
    window.location.assign(url.toString());
  };

  if (activePanelKind) {
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
      <aside className="shell-rail" aria-label="Role navigation">
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
                <span>{scope.label}</span>
                <small>{scope.description}</small>
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
                  className="shell-nav-button"
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
