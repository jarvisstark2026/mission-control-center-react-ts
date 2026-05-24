import type { WorkspaceWidget } from './workspaceTypes';
import { buildPanelWindowUrl, buildWorkspaceExtensionWindowUrl, buildWorkspaceHubUrl } from './workspacePanelRouting';
import {
  canCreateWorkspaceExtensionInstance,
  createWorkspaceInstanceId,
  markCurrentWorkspaceExtensionClosed,
  markWorkspaceInstanceRestorable,
  registerWorkspaceExtensionInstance,
} from './workspaceInstances';

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

function createTauriWorkspaceWindowLabel(instanceId: string) {
  return `workspace-instance-${instanceId}`.replace(/[^a-zA-Z0-9_:/-]/g, '-');
}

function getTauriWindowUrl(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`;
}

function openTauriWorkspaceExtensionWindow(instanceId: string, url: URL) {
  if (!isTauriRuntime()) return false;

  if (!registerWorkspaceExtensionInstance({ id: instanceId, popup: null, url: url.toString() })) {
    return false;
  }

  void import('@tauri-apps/api/webviewWindow')
    .then(async ({ WebviewWindow }) => {
      const label = createTauriWorkspaceWindowLabel(instanceId);
      const existingWindow = await WebviewWindow.getByLabel(label).catch(() => null);

      if (existingWindow) {
        await existingWindow.setFocus().catch(() => undefined);
        return;
      }

      const workspaceWindow = new WebviewWindow(label, {
        url: getTauriWindowUrl(url),
        title: 'Mission Control Center Workspace',
        width: 1440,
        height: 960,
        minWidth: 900,
        minHeight: 640,
        resizable: true,
        focus: true,
      });

      void workspaceWindow.once('tauri://created', () => {
        void workspaceWindow.setFocus().catch(() => undefined);
      });
      void workspaceWindow.once('tauri://error', () => {
        markWorkspaceInstanceRestorable(instanceId);
      });
    })
    .catch(() => {
      markWorkspaceInstanceRestorable(instanceId);
    });

  return true;
}

function closeCurrentTauriWindow() {
  if (!isTauriRuntime()) return false;

  void import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) => getCurrentWindow().close())
    .catch(() => undefined);
  return true;
}

export function openWorkspacePanelWindow(kind: WorkspaceWidget['kind']) {
  if (typeof window === 'undefined') return false;

  const url = buildPanelWindowUrl(kind);
  const popup = window.open(url.toString(), '_blank', 'popup=yes,width=1280,height=900');
  if (!popup) {
    window.location.assign(url.toString());
    return true;
  }

  popup.focus?.();
  return true;
}

export function returnToWorkspaceHub() {
  if (typeof window === 'undefined') return false;

  const url = buildWorkspaceHubUrl();
  if (url.toString() === window.location.href) return false;

  window.history.replaceState({}, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
  return true;
}

export function closeWorkspacePanelWindow() {
  if (typeof window === 'undefined') return false;

  if (closeCurrentTauriWindow()) return true;

  window.close();
  if (!window.closed) {
    return returnToWorkspaceHub();
  }

  return true;
}

export function closeWorkspaceExtensionWindow() {
  if (typeof window === 'undefined') return false;

  markCurrentWorkspaceExtensionClosed();
  if (closeCurrentTauriWindow()) return true;

  window.close();
  if (!window.closed) {
    return returnToWorkspaceHub();
  }

  return true;
}

export function openWorkspaceExtensionWindow(workspaceInstanceId?: string) {
  if (typeof window === 'undefined') return false;

  const instanceId = workspaceInstanceId ?? createWorkspaceInstanceId();
  if (!workspaceInstanceId && !canCreateWorkspaceExtensionInstance()) return false;

  const url = buildWorkspaceExtensionWindowUrl(undefined, instanceId);
  if (openTauriWorkspaceExtensionWindow(instanceId, url)) {
    return true;
  }

  const popup = window.open(url.toString(), '_blank', 'popup=yes,width=1440,height=960');
  if (!popup) {
    return false;
  }

  if (!registerWorkspaceExtensionInstance({ id: instanceId, popup, url: url.toString() })) {
    popup.close();
    return false;
  }
  popup.focus?.();
  return true;
}
