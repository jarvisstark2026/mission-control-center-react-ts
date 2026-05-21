import { useEffect } from 'react';

import { ActionButton } from '../../components/ui/ActionButton';
import { classNames } from '../../lib/classNames';
import { Workspace } from '../workspace/Workspace';
import type { WorkspaceWidget } from '../workspace/workspaceTypes';
import { DetachedShellWindow, ShellRail } from './ShellChrome';
import { getShellNavPanelKind, getVisibleShellNavItems, isShellPanelAccessible, shellNavItems } from './nav';
import type { ShellRole } from './roles';
import { defaultShellRole, getPanelLabel, getRoleLabel, normalizePanelKind } from './shellCopy';
import { useResponsiveRail } from './useResponsiveRail';
import './shell.css';

type ShellProps = {
  panelKind?: WorkspaceWidget['kind'] | null;
  role?: ShellRole;
  onNavigate: (nextLocation: { panelKind: WorkspaceWidget['kind'] | null; role: ShellRole }) => void;
};

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

function getActiveNavId(panelKind: WorkspaceWidget['kind'] | null) {
  if (!panelKind) return 'workspace';

  const visibleNavEntry = shellNavItems.find((item) => getShellNavPanelKind(item) === panelKind);
  if (visibleNavEntry) {
    return visibleNavEntry.id;
  }

  return 'workspace';
}

export function Shell({ panelKind = null, role = defaultShellRole, onNavigate }: ShellProps) {
  const activeRole = role ?? defaultShellRole;
  const visibleItems = getVisibleShellNavItems(activeRole);
  const activePanelKind = normalizePanelKind(panelKind);
  const activeNavId = getActiveNavId(activePanelKind);
  const canOpenPanel = isShellPanelAccessible(activeRole, activePanelKind);
  const isDetachedWindow = Boolean(activePanelKind && canOpenPanel);
  const canCloseDetachedWindow = typeof window !== 'undefined' && Boolean(window.opener);
  const activeRoleLabel = getRoleLabel(activeRole);
  const activePanelLabel = activePanelKind ? getPanelLabel(activePanelKind) : 'Workspace';
  const { closeRailOnMobile, isRailOpen, menuToggleRef, setIsRailOpen } = useResponsiveRail();

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
      <DetachedShellWindow
        activePanelKind={activePanelKind}
        activePanelLabel={activePanelLabel}
        activeRole={activeRole}
        activeRoleLabel={activeRoleLabel}
        canCloseDetachedWindow={canCloseDetachedWindow}
        onClose={() => closeDetachedWindow(navigateToPanel)}
        onOpenHub={() => navigateToPanel(null)}
      />
    );
  }

  return (
    <section className="shell-frame" aria-label="Mission Control Center shell">
      <ActionButton
        ref={menuToggleRef}
        variant="ghost"
        className="shell-menu-toggle"
        aria-label={isRailOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-controls="shell-rail"
        aria-expanded={isRailOpen}
        onClick={() => setIsRailOpen((current) => !current)}
      >
        ☰
      </ActionButton>

      <div
        className={classNames('shell-backdrop', isRailOpen && 'is-visible')}
        aria-hidden="true"
        onClick={closeRailOnMobile}
      />

      <ShellRail
        activeNavId={activeNavId}
        activePanelKind={activePanelKind}
        activePanelLabel={activePanelLabel}
        activeRole={activeRole}
        activeRoleLabel={activeRoleLabel}
        isRailOpen={isRailOpen}
        visibleItems={visibleItems}
        onNavigatePanel={navigateToPanel}
        onNavigateRole={navigateToRole}
      />

      <div className="shell-workspace">
        <Workspace />
      </div>
    </section>
  );
}
