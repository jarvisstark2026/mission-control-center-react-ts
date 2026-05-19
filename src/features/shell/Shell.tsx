import { useEffect, useState } from 'react';

import { SectionHeader } from '../../components/ui/SectionHeader';
import { StatusChip } from '../../components/ui/StatusChip';
import { Workspace } from '../workspace/Workspace';
import { isWorkspaceWidgetKind, type WorkspaceWidget } from '../workspace/workspaceTypes';
import { getVisibleShellNavItems, isShellPanelAccessible } from './nav';
import { shellScopes, type ShellRole } from './roles';
import './shell.css';

const defaultRole: ShellRole = 'support';
const railBreakpoint = 900;

type ShellProps = {
  panelKind?: WorkspaceWidget['kind'] | null;
  role?: ShellRole;
  onNavigate: (nextLocation: { panelKind: WorkspaceWidget['kind'] | null; role: ShellRole }) => void;
};

const panelLabels: Partial<Record<WorkspaceWidget['kind'], string>> = {
  overview: 'Command core',
  graph: 'Telemetry',
  audio: 'Audio preview',
  map: 'Map / routes',
  diagram: 'Diagram preview',
  project: 'Project list',
  news: 'Markets',
  schedule: 'Schedule',
  launcher: 'App launcher',
  browser: 'Browser',
  'watch-video': 'Live TV',
  image: 'Image preview',
  pdf: 'PDF',
  'file-explorer': 'File explorer',
  'native-app': 'Native app bridge',
  'window-manager': 'Registry',
  sheet: 'Spreadsheet',
  docs: 'Docs',
  slides: 'Presentation',
  'trading-graph': 'Trading graph',
  video: 'Media frame',
  '3d': 'Preview',
  '3d-studio': '3D studio',
  flow: 'Workflows',
  list: 'List',
};

function getPanelLabel(panelKind: WorkspaceWidget['kind'] | null | undefined) {
  return (panelKind && panelLabels[panelKind]) || 'Window';
}

function normalizePanelKind(panelKind: string | null | undefined): WorkspaceWidget['kind'] | null {
  return panelKind && isWorkspaceWidgetKind(panelKind) ? panelKind : null;
}

function getRoleLabel(role: ShellRole) {
  return shellScopes.find((scope) => scope.id === role)?.label ?? 'Support';
}

function getRoleDescription(role: ShellRole) {
  return shellScopes.find((scope) => scope.id === role)?.description ?? 'Support';
}

function getShellCopy(role: ShellRole, panelKind: WorkspaceWidget['kind'] | null, detached: boolean) {
  const roleDescription = getRoleDescription(role);

  if (detached && panelKind) {
    return `Detached window mode. ${getPanelLabel(panelKind)} is operating independently while I keep the paperwork in order.`;
  }

  if (panelKind) {
    return `${roleDescription} Current surface: ${getPanelLabel(panelKind)}.`;
  }

  return `${roleDescription} Open a surface when you are ready.`;
}

function closeDetachedWindow(navigateToPanel: (target: WorkspaceWidget['kind'] | null) => void) {
  if (window.opener) {
    window.close();
    if (!window.closed) {
      navigateToPanel(null);
    }
    return;
  }

  navigateToPanel(null);
}

const navPanelById: Record<string, WorkspaceWidget['kind'] | null> = {
  workspace: null,
  telemetry: 'graph',
  map: 'map',
  project: 'project',
  registry: 'window-manager',
  schedule: 'schedule',
  launcher: 'launcher',
  browser: 'browser',
  'watch-video': 'watch-video',
  audio: 'audio',
  diagram: 'diagram',
  news: 'news',
  flow: 'flow',
  video: 'video',
  '3d': '3d',
  list: 'list',
  'file-explorer': 'file-explorer',
  'native-app': 'native-app',
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

  const visibleNavEntry = Object.entries(navPanelById).find(([, mappedPanelKind]) => mappedPanelKind === panelKind);
  if (visibleNavEntry) {
    return visibleNavEntry[0];
  }

  if (Object.prototype.hasOwnProperty.call(navPanelById, panelKind)) {
    return panelKind;
  }

  return 'workspace';
}

export function Shell({ panelKind = null, role = defaultRole, onNavigate }: ShellProps) {
  const activeRole = role ?? defaultRole;
  const visibleItems = getVisibleShellNavItems(activeRole);
  const activePanelKind = normalizePanelKind(panelKind);
  const activeNavId = getActiveNavId(activePanelKind);
  const isNavItemActive = (itemId: string) => itemId === activeNavId;
  const canOpenPanel = isShellPanelAccessible(activeRole, activePanelKind);
  const isDetachedWindow = Boolean(activePanelKind && canOpenPanel);
  const canCloseDetachedWindow = typeof window !== 'undefined' && Boolean(window.opener);
  const activeRoleLabel = getRoleLabel(activeRole);
  const activePanelLabel = activePanelKind ? getPanelLabel(activePanelKind) : 'Workspace';
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
      ? `Mission Control Center — ${activePanelLabel} · ${activeRoleLabel}`
      : activePanelKind
        ? `Mission Control Center — ${activeRoleLabel} · ${activePanelLabel}`
        : `Mission Control Center — ${activeRoleLabel}`;
  }, [activePanelLabel, activePanelKind, activeRoleLabel, isDetachedWindow]);

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
              <div className="shell-meta" aria-label="Window context">
                <StatusChip tone="cool">{activeRoleLabel}</StatusChip>
                <StatusChip tone="ice">{activePanelLabel}</StatusChip>
              </div>
              <p className="shell-copy">{getShellCopy(activeRole, activePanelKind, true)}</p>
            </div>

            <div className="shell-window-actions">
              <button type="button" className="shell-window-button" onClick={() => navigateToPanel(null)}>
                Open hub
              </button>
              <button
                type="button"
                className="shell-window-button is-muted"
                onClick={() => closeDetachedWindow(navigateToPanel)}
              >
                {canCloseDetachedWindow ? 'Close window' : 'Return to hub'}
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
          <div className="shell-meta" aria-label="Current context">
            <StatusChip tone="cool">{activeRoleLabel}</StatusChip>
            <StatusChip tone="ice">{activePanelLabel}</StatusChip>
          </div>
          <p className="shell-copy">{getShellCopy(activeRole, activePanelKind, false)}</p>
        </div>

        <div className="shell-scope-group">
          <SectionHeader
            eyebrow="Access"
            title="Scopes"
            description="Choose the operating band before opening a surface."
          />
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
          <SectionHeader
            eyebrow="Routing"
            title="Navigation"
            description="Open the relevant control surface without the usual detour through a menu maze."
          />
          <ul className="shell-nav-list">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`shell-nav-button ${isNavItemActive(item.id) ? 'is-active' : ''}`}
                  aria-current={isNavItemActive(item.id) ? 'page' : undefined}
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
