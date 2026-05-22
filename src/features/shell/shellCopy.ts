import { isWorkspaceWidgetKind, type WorkspaceWidget } from '../workspace/workspaceTypes';
import { shellScopes, type ShellRole } from './roles';

export const defaultShellRole: ShellRole = 'support';

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
  'window-manager': 'Manager',
  sheet: 'Spreadsheet',
  docs: 'Docs',
  slides: 'Presentation',
  'trading-graph': 'Trading graph',
  video: 'Media frame',
  '3d': 'Preview',
  '3d-studio': '3D studio',
  flow: 'Workflows',
  list: 'List',
  'command-inbox': 'Command inbox',
  notifications: 'Notifications',
  'integration-registry': 'Integration registry',
  'agent-control': 'Agent control',
};

export function getPanelLabel(panelKind: WorkspaceWidget['kind'] | null | undefined) {
  return (panelKind && panelLabels[panelKind]) || 'Window';
}

export function normalizePanelKind(panelKind: string | null | undefined): WorkspaceWidget['kind'] | null {
  return panelKind && isWorkspaceWidgetKind(panelKind) ? panelKind : null;
}

export function getRoleLabel(role: ShellRole) {
  return shellScopes.find((scope) => scope.id === role)?.label ?? 'Support';
}

export function getRoleDescription(role: ShellRole) {
  return shellScopes.find((scope) => scope.id === role)?.description ?? 'Support';
}

export function getShellCopy(role: ShellRole, panelKind: WorkspaceWidget['kind'] | null, detached: boolean) {
  const roleDescription = getRoleDescription(role);

  if (detached && panelKind) {
    return `Connected extension screen. ${getPanelLabel(panelKind)} stays linked to the main workspace while I keep the paperwork in order.`;
  }

  if (panelKind) {
    return `${roleDescription} Current surface: ${getPanelLabel(panelKind)}.`;
  }

  return `${roleDescription} Open a surface when you are ready.`;
}
