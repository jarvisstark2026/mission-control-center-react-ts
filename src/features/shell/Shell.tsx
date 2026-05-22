import { useEffect, useState } from 'react';

import { ActionButton } from '../../components/ui/ActionButton';
import { classNames } from '../../lib/classNames';
import { Workspace } from '../workspace/Workspace';
import { closeWorkspaceExtensionWindow, openWorkspaceExtensionWindow } from '../workspace/workspacePanelWindows';
import { isWorkspaceExtensionUrl } from '../workspace/workspacePanelRouting';
import {
  closeWorkspaceInstance,
  getWorkspaceInstances,
  markCurrentWorkspaceExtensionClosed,
  markCurrentWorkspaceExtensionOpen,
  pruneClosedWorkspaceInstances,
  subscribeWorkspaceInstanceCloseRequests,
  subscribeWorkspaceInstances,
  updateWorkspaceInstancePlacement,
  type WorkspacePlacement,
} from '../workspace/workspaceInstances';
import type { WorkspaceWidget } from '../workspace/workspaceTypes';
import { DetachedShellWindow, ShellRail, ShellRoleMenu } from './ShellChrome';
import { isShellPanelAccessible } from './nav';
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

export function Shell({ panelKind = null, role = defaultShellRole, onNavigate }: ShellProps) {
  const activeRole = role ?? defaultShellRole;
  const activePanelKind = normalizePanelKind(panelKind);
  const isWorkspaceExtension = isWorkspaceExtensionUrl();
  const canOpenPanel = isShellPanelAccessible(activeRole, activePanelKind);
  const isDetachedWindow = Boolean(activePanelKind && canOpenPanel);
  const canCloseDetachedWindow = typeof window !== 'undefined' && Boolean(window.opener);
  const activeRoleLabel = getRoleLabel(activeRole);
  const activePanelLabel = activePanelKind ? getPanelLabel(activePanelKind) : 'Workspace';
  const { closeRailOnMobile, isRailOpen, menuToggleRef, setIsRailOpen } = useResponsiveRail();
  const [workspaceInstances, setWorkspaceInstances] = useState(getWorkspaceInstances);

  useEffect(() => {
    const refreshInstances = () => setWorkspaceInstances(getWorkspaceInstances());
    const currentExtensionId = markCurrentWorkspaceExtensionOpen();
    const unsubscribeInstances = subscribeWorkspaceInstances(refreshInstances);
    const unsubscribeCloseRequests = currentExtensionId
      ? subscribeWorkspaceInstanceCloseRequests(currentExtensionId, closeWorkspaceExtensionWindow)
      : () => undefined;
    const unregisterExtensionUnload = currentExtensionId
      ? (() => {
          const unregisterCurrentExtension = () => markCurrentWorkspaceExtensionClosed();

          window.addEventListener('pagehide', unregisterCurrentExtension);
          window.addEventListener('beforeunload', unregisterCurrentExtension);

          return () => {
            window.removeEventListener('pagehide', unregisterCurrentExtension);
            window.removeEventListener('beforeunload', unregisterCurrentExtension);
          };
        })()
      : () => undefined;
    const heartbeatCurrentExtensionInterval = currentExtensionId
      ? window.setInterval(markCurrentWorkspaceExtensionOpen, 2000)
      : null;
    const pruneClosedInstancesInterval = currentExtensionId
      ? null
      : window.setInterval(() => {
          if (pruneClosedWorkspaceInstances()) {
            refreshInstances();
          }
        }, 1000);

    refreshInstances();

    return () => {
      if (heartbeatCurrentExtensionInterval) {
        window.clearInterval(heartbeatCurrentExtensionInterval);
      }
      if (pruneClosedInstancesInterval) {
        window.clearInterval(pruneClosedInstancesInterval);
      }
      unregisterExtensionUnload();
      unsubscribeInstances();
      unsubscribeCloseRequests();
      markCurrentWorkspaceExtensionClosed();
    };
  }, []);

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

  const openMainWorkspace = () => {
    closeRailOnMobile();

    if (isWorkspaceExtension && window.opener) {
      window.opener.focus?.();
      return;
    }

    onNavigate({ panelKind: null, role: activeRole });
  };

  const closeWorkspaceExtensionInstance = (id: string) => {
    closeWorkspaceInstance(id);
    setWorkspaceInstances(getWorkspaceInstances());
  };
  const createWorkspaceExtensionInstance = () => {
    openWorkspaceExtensionWindow();
    setWorkspaceInstances(getWorkspaceInstances());
  };
  const placeWorkspaceExtensionInstance = (id: string, placement: WorkspacePlacement) => {
    updateWorkspaceInstancePlacement(id, placement);
    setWorkspaceInstances(getWorkspaceInstances());
  };
  const renderFooterNavigationButton = (key: string, withFocusRef = false) => (
    <ActionButton
      key={key}
      ref={withFocusRef ? menuToggleRef : undefined}
      variant="ghost"
      className="workspace-launch-button workspace-footer-button shell-footer-menu-button"
      aria-label={isRailOpen ? 'Close workspace navigation' : 'Open workspace navigation'}
      aria-controls="shell-rail"
      aria-expanded={isRailOpen}
      onClick={() => setIsRailOpen((current) => !current)}
    >
      <span className="shell-footer-menu-icon" aria-hidden="true">
        <span />
      </span>
    </ActionButton>
  );
  const footerNavigationControl = !isWorkspaceExtension ? (
    <>
      {renderFooterNavigationButton('workspace-navigation-primary', true)}
      {renderFooterNavigationButton('workspace-navigation-secondary')}
    </>
  ) : null;

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
    <section className={classNames('shell-frame', isWorkspaceExtension && 'shell-frame-extension')} aria-label="Mission Control Center shell">
      {!isWorkspaceExtension ? (
        <>
          <ActionButton
            hidden
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
            isRailOpen={isRailOpen}
            workspaceInstances={workspaceInstances}
            onCreateWorkspaceInstance={createWorkspaceExtensionInstance}
            onOpenMainWorkspace={openMainWorkspace}
            onCloseWorkspaceInstance={closeWorkspaceExtensionInstance}
            onPlaceWorkspaceInstance={placeWorkspaceExtensionInstance}
          />
        </>
      ) : null}

      <div className="shell-workspace">
        <Workspace
          topBarSlot={
            !isWorkspaceExtension ? (
              <ShellRoleMenu activeRole={activeRole} activeRoleLabel={activeRoleLabel} onNavigateRole={navigateToRole} />
            ) : null
          }
          footerSlot={footerNavigationControl}
        />
      </div>
    </section>
  );
}
