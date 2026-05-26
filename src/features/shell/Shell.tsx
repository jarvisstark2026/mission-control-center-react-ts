import { useEffect, useState } from 'react';

import { ActionButton } from '../../components/ui/ActionButton';
import { classNames } from '../../lib/classNames';
import { Workspace } from '../workspace/Workspace';
import { closeWorkspaceExtensionWindow, openWorkspaceExtensionWindow } from '../workspace/workspacePanelWindows';
import { isWorkspaceExtensionUrl } from '../workspace/workspacePanelRouting';
import {
  closeWorkspaceInstance,
  getWorkspaceInstanceId,
  getWorkspaceInstances,
  markCurrentWorkspaceExtensionOpen,
  markWorkspaceInstanceRestorable,
  pruneClosedWorkspaceInstances,
  subscribeWorkspaceInstanceCloseRequests,
  subscribeWorkspaceInstances,
  updateWorkspaceInstancePlacement,
  type WorkspacePlacement,
} from '../workspace/workspaceInstances';
import type { WorkspaceWidget } from '../workspace/workspaceTypes';
import { DetachedShellWindow, ShellRail, ShellRoleMenu, ShellThemeMenu } from './ShellChrome';
import { isShellPanelAccessible } from './nav';
import type { ShellRole } from './roles';
import { defaultShellRole, getPanelLabel, getRoleLabel, normalizePanelKind } from './shellCopy';
import { applyShellTheme, persistShellTheme, readStoredShellTheme, type ShellThemeId } from './themes';
import { useResponsiveRail } from './useResponsiveRail';
import './shell.css';

type ShellProps = {
  panelKind?: WorkspaceWidget['kind'] | null;
  role?: ShellRole;
  onNavigate: (nextLocation: { panelKind: WorkspaceWidget['kind'] | null; role: ShellRole }) => void;
};

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
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

function subscribeTauriWorkspaceFrameClose(workspaceId: string) {
  if (typeof window === 'undefined' || !(window as TauriWindow).__TAURI_INTERNALS__) {
    return () => undefined;
  }

  let unlisten: (() => void) | null = null;
  void import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) =>
      getCurrentWindow().onCloseRequested(() => {
        markWorkspaceInstanceRestorable(workspaceId);
      }),
    )
    .then((nextUnlisten) => {
      unlisten = nextUnlisten;
    })
    .catch(() => undefined);

  return () => {
    unlisten?.();
  };
}

export function Shell({ panelKind = null, role = defaultShellRole, onNavigate }: ShellProps) {
  const activeRole = role ?? defaultShellRole;
  const activePanelKind = normalizePanelKind(panelKind);
  const isWorkspaceExtension = isWorkspaceExtensionUrl();
  const workspaceLifecycleKey = isWorkspaceExtension ? `extension:${getWorkspaceInstanceId() ?? 'workspace-extension'}` : 'main';
  const canOpenPanel = isShellPanelAccessible(activeRole, activePanelKind);
  const isDetachedWindow = Boolean(activePanelKind && canOpenPanel);
  const canCloseDetachedWindow = typeof window !== 'undefined' && Boolean(window.opener);
  const activeRoleLabel = getRoleLabel(activeRole);
  const activePanelLabel = activePanelKind ? getPanelLabel(activePanelKind) : 'Workspace';
  const { closeRailOnMobile, isRailOpen, menuToggleRef, setIsRailOpen } = useResponsiveRail();
  const [workspaceInstances, setWorkspaceInstances] = useState(getWorkspaceInstances);
  const [activeTheme, setActiveTheme] = useState(readStoredShellTheme);

  useEffect(() => {
    const refreshInstances = () => setWorkspaceInstances(getWorkspaceInstances());
    const currentExtensionId = markCurrentWorkspaceExtensionOpen();
    const unsubscribeInstances = subscribeWorkspaceInstances(refreshInstances);
    const unsubscribeCloseRequests = currentExtensionId
      ? subscribeWorkspaceInstanceCloseRequests(currentExtensionId, closeWorkspaceExtensionWindow)
      : () => undefined;
    const unsubscribeTauriFrameClose = currentExtensionId ? subscribeTauriWorkspaceFrameClose(currentExtensionId) : () => undefined;
    const unregisterExtensionUnload = currentExtensionId
      ? (() => {
          const unregisterCurrentExtension = () => markWorkspaceInstanceRestorable(currentExtensionId);

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
      unsubscribeTauriFrameClose();
      unsubscribeInstances();
      unsubscribeCloseRequests();
      if (currentExtensionId) {
        markWorkspaceInstanceRestorable(currentExtensionId);
      }
    };
  }, [workspaceLifecycleKey]);

  useEffect(() => {
    document.title = isDetachedWindow
      ? `Mission Control - ${activePanelLabel} - ${activeRoleLabel}`
      : activePanelKind
        ? `Mission Control - ${activeRoleLabel} - ${activePanelLabel}`
        : `Mission Control - ${activeRoleLabel}`;
  }, [activePanelLabel, activePanelKind, activeRoleLabel, isDetachedWindow]);

  useEffect(() => {
    applyShellTheme(activeTheme);
    persistShellTheme(activeTheme);
  }, [activeTheme]);

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
  const openWorkspaceExtensionInstance = (id: string) => {
    openWorkspaceExtensionWindow(id);
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
  const selectTheme = (themeId: ShellThemeId) => {
    setActiveTheme(themeId);
  };
  const renderFooterNavigationButton = (key: string, withFocusRef = false) => (
    <ActionButton
      key={key}
      ref={withFocusRef ? menuToggleRef : undefined}
      variant="ghost"
      className="workspace-launch-button workspace-footer-button shell-footer-menu-button"
      aria-label={isRailOpen ? 'Close workspace setup' : 'Open workspace setup'}
      aria-controls="shell-rail"
      aria-expanded={isRailOpen}
      title={isRailOpen ? 'Close workspace setup' : 'Open workspace setup'}
      onClick={() => setIsRailOpen((current) => !current)}
    >
      <span className="shell-footer-menu-icon" aria-hidden="true">
        <span />
      </span>
    </ActionButton>
  );
  const footerNavigationControl = !isWorkspaceExtension ? (
    renderFooterNavigationButton('workspace-navigation-primary', true)
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
    <section className={classNames('shell-frame', isWorkspaceExtension && 'shell-frame-extension')} aria-label="Mission Control shell">
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
            <span className="shell-footer-menu-icon" aria-hidden="true">
              <span />
            </span>
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
            onOpenWorkspaceInstance={openWorkspaceExtensionInstance}
            onCloseWorkspaceInstance={closeWorkspaceExtensionInstance}
            onPlaceWorkspaceInstance={placeWorkspaceExtensionInstance}
          />
        </>
      ) : null}

      <div className="shell-workspace">
        <Workspace
          role={activeRole}
          topBarVisualSlot={!isWorkspaceExtension ? <ShellThemeMenu activeTheme={activeTheme} onSelectTheme={selectTheme} /> : null}
          topBarOperatorSlot={!isWorkspaceExtension ? <ShellRoleMenu activeRole={activeRole} activeRoleLabel={activeRoleLabel} onNavigateRole={navigateToRole} /> : null}
          footerSlot={footerNavigationControl}
        />
      </div>
    </section>
  );
}
