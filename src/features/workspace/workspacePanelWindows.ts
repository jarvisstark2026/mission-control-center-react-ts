import type { WorkspaceWidget } from './workspaceTypes';
import { buildPanelWindowUrl, buildWorkspaceHubUrl } from './workspacePanelRouting';

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
