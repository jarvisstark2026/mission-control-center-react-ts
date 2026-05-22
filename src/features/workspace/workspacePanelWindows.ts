import type { WorkspaceWidget } from './workspaceTypes';
import { buildPanelWindowUrl, buildWorkspaceExtensionWindowUrl, buildWorkspaceHubUrl } from './workspacePanelRouting';
import {
  canCreateWorkspaceExtensionInstance,
  createWorkspaceInstanceId,
  markCurrentWorkspaceExtensionClosed,
  registerWorkspaceExtensionInstance,
} from './workspaceInstances';

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

  window.close();
  if (!window.closed) {
    return returnToWorkspaceHub();
  }

  return true;
}

export function closeWorkspaceExtensionWindow() {
  if (typeof window === 'undefined') return false;

  markCurrentWorkspaceExtensionClosed();
  window.close();
  if (!window.closed) {
    return returnToWorkspaceHub();
  }

  return true;
}

export function openWorkspaceExtensionWindow() {
  if (typeof window === 'undefined') return false;
  if (!canCreateWorkspaceExtensionInstance()) return false;

  const instanceId = createWorkspaceInstanceId();
  const url = buildWorkspaceExtensionWindowUrl(undefined, instanceId);
  const popup = window.open(url.toString(), '_blank', 'popup=yes,width=1440,height=960');
  if (!popup) {
    window.location.assign(url.toString());
    return true;
  }

  if (!registerWorkspaceExtensionInstance({ id: instanceId, popup, url: url.toString() })) {
    popup.close();
    return false;
  }
  popup.focus?.();
  return true;
}
