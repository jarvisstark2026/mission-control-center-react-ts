import { isWorkspaceWidgetKind, type WorkspaceWidget } from '../workspace/workspaceTypes';
import { isShellRole, type ShellRole } from './roles';

export type ShellLocationState = {
  panelKind: WorkspaceWidget['kind'] | null;
  role: ShellRole;
};

export function readShellLocationFromSearch(search: string, defaultRole: ShellRole): ShellLocationState {
  const searchParams = new URLSearchParams(search);
  const roleParam = searchParams.get('role');
  const panelParam = searchParams.get('panel');
  const role = roleParam && isShellRole(roleParam) ? roleParam : defaultRole;

  return {
    role,
    panelKind: panelParam && isWorkspaceWidgetKind(panelParam) ? panelParam : null,
  };
}

export function applyShellLocationToUrl(url: URL, locationState: ShellLocationState) {
  url.searchParams.set('role', locationState.role);

  if (locationState.panelKind) url.searchParams.set('panel', locationState.panelKind);
  else url.searchParams.delete('panel');

  return url;
}

export function getCanonicalShellLocationHref(baseUrl: string, locationState: ShellLocationState) {
  const url = new URL(baseUrl);
  applyShellLocationToUrl(url, locationState);
  return url.toString();
}
