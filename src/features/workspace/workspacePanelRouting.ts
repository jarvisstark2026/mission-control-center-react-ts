import { readShellLocationFromSearch } from '../shell/location';
import type { ShellRole } from '../shell/roles';
import type { WorkspaceWidget } from './workspaceTypes';

const workspaceModeParam = 'workspace';
const workspaceExtensionMode = 'extension';

function getCurrentHref() {
  return typeof window === 'undefined' ? 'http://localhost/' : window.location.href;
}

export function getCurrentShellRole(search = typeof window === 'undefined' ? '' : window.location.search): ShellRole {
  return readShellLocationFromSearch(search, 'support').role;
}

export function buildPanelWindowUrl(kind: WorkspaceWidget['kind'], href = getCurrentHref()) {
  const url = new URL(href);
  url.searchParams.set('role', getCurrentShellRole(url.search));
  url.searchParams.set('panel', kind);
  return url;
}

export function buildWorkspaceHubUrl(href = getCurrentHref()) {
  const url = new URL(href);
  url.searchParams.delete('panel');
  url.searchParams.delete(workspaceModeParam);
  return url;
}

export function buildWorkspaceExtensionWindowUrl(href = getCurrentHref()) {
  const url = buildWorkspaceHubUrl(href);
  url.searchParams.set('role', getCurrentShellRole(url.search));
  url.searchParams.set(workspaceModeParam, workspaceExtensionMode);
  return url;
}

export function isWorkspaceExtensionUrl(search = typeof window === 'undefined' ? '' : window.location.search) {
  return new URLSearchParams(search).get(workspaceModeParam) === workspaceExtensionMode;
}
