import { readShellLocationFromSearch } from '../shell/location';
import type { ShellRole } from '../shell/roles';
import type { WorkspaceWidget } from './workspaceTypes';

export function getCurrentShellRole(search = typeof window === 'undefined' ? '' : window.location.search): ShellRole {
  return readShellLocationFromSearch(search, 'support').role;
}

export function buildPanelWindowUrl(kind: WorkspaceWidget['kind'], href = window.location.href) {
  const url = new URL(href);
  url.searchParams.set('role', getCurrentShellRole(url.search));
  url.searchParams.set('panel', kind);
  return url;
}

export function buildWorkspaceHubUrl(href = window.location.href) {
  const url = new URL(href);
  url.searchParams.delete('panel');
  return url;
}
