import type { WorkspaceWidget } from './workspaceTypes';
import type { WidgetBlueprint } from './workspaceStorage';
import type { ShellRole } from '../shell/roles';
import type { WorkspaceWidgetPermissionMatrix } from './workspaceWidgetPermissions';
import { getDefaultWorkspaceWidgetPermission, isWorkspaceWidgetPermittedByPolicy } from './workspaceWidgetPermissions';

export const workspaceShortcutKinds: WorkspaceWidget['kind'][] = [
  'overview',
  'graph',
  'audio',
  'map',
  'diagram',
  'project',
  'news',
  'schedule',
  'launcher',
  'watch-video',
  'file-explorer',
  'native-app',
  'window-manager',
  'sheet',
  'docs',
  'slides',
  'trading-graph',
  'image',
  'pdf',
  'video',
  '3d',
  '3d-studio',
  'flow',
  'list',
  'command-inbox',
  'notifications',
  'integration-registry',
  'agent-control',
  'agent-console',
  'hermes-hud',
  'home-systems',
  'goals',
  'app-portal',
  'json-surface',
];

type WorkspaceLauncherEntry = {
  kind: WorkspaceWidget['kind'];
  note: string;
};

const workspaceLauncherNotes: Partial<Record<WorkspaceWidget['kind'], string>> = {
  news: 'open graph library',
  'window-manager': 'track workspace widgets',
  'trading-graph': 'focus market chart',
  'command-inbox': 'review approvals',
  notifications: 'watch live alerts',
  'integration-registry': 'inspect devices',
  'agent-control': 'inspect agent bridge',
  'agent-console': 'review agent proposals',
  'hermes-hud': 'talk to Hermes live',
  'home-systems': 'monitor the home',
  goals: 'run the OS loop',
  'app-portal': 'open external tools',
  'json-surface': 'render agent JSON',
};

const workspaceLauncherKinds = workspaceShortcutKinds.filter((kind) => kind !== 'native-app');

const workspaceWidgetAllowedRoles: Partial<Record<WorkspaceWidget['kind'], ShellRole[]>> = {
  'agent-control': ['admin', 'support', 'home'],
  'agent-console': ['admin', 'support', 'home'],
  'hermes-hud': ['admin', 'support', 'home'],
  'home-systems': ['admin', 'support', 'home', 'guest'],
  goals: ['admin', 'support', 'home', 'guest'],
  'app-portal': ['admin', 'support', 'home', 'guest'],
  'json-surface': ['admin', 'support', 'home'],
};

export function isWorkspaceWidgetAllowedForRole(
  kind: WorkspaceWidget['kind'],
  role: ShellRole,
  permissions?: WorkspaceWidgetPermissionMatrix,
) {
  if (permissions) return isWorkspaceWidgetPermittedByPolicy(kind, role, permissions);
  return workspaceWidgetAllowedRoles[kind]?.includes(role) ?? getDefaultWorkspaceWidgetPermission(kind, role);
}

export function getWorkspaceShortcutKindsForRole(role: ShellRole, permissions?: WorkspaceWidgetPermissionMatrix) {
  return workspaceShortcutKinds.filter((kind) => isWorkspaceWidgetAllowedForRole(kind, role, permissions));
}

export const widgetBlueprints: Record<WorkspaceWidget['kind'], WidgetBlueprint> = {
  overview: { title: 'Command core', subtitle: 'open / move / stack', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 300, minHeight: 180 },
  graph: { title: 'Telemetry', subtitle: 'live curves', surfaceAlpha: 0.085, lineAlpha: 0.16, minWidth: 280, minHeight: 170 },
  audio: { title: 'Audio preview', subtitle: 'hold / play / mix', surfaceAlpha: 0.1, lineAlpha: 0.17, minWidth: 260, minHeight: 170 },
  map: { title: 'Map / routes', subtitle: 'locations / zones', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 250, minHeight: 170 },
  diagram: { title: 'Diagram preview', subtitle: 'system structure', surfaceAlpha: 0.078, lineAlpha: 0.15, minWidth: 260, minHeight: 170 },
  project: { title: 'Project list', subtitle: 'tasks / backlog', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
  news: { title: 'Markets', subtitle: 'watchlist', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 240, minHeight: 150 },
  schedule: { title: 'Schedule', subtitle: 'day / week / next', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 280, minHeight: 170 },
  launcher: { title: 'App launcher', subtitle: 'apps / desktop hooks', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 180 },
  'watch-video': { title: 'Live TV', subtitle: 'channels / streams', surfaceAlpha: 0.078, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'file-explorer': { title: 'File explorer', subtitle: 'folders / files', surfaceAlpha: 0.076, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  'native-app': { title: 'Native app bridge', subtitle: 'installed apps / external windows', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 320, minHeight: 200 },
  'window-manager': { title: 'Manager', subtitle: 'widgets / state / focus', surfaceAlpha: 0.08, lineAlpha: 0.15, minWidth: 300, minHeight: 200 },
  sheet: { title: 'Spreadsheet', subtitle: 'cells / formulas', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 320, minHeight: 220 },
  docs: { title: 'Docs', subtitle: 'writing / outline', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 300, minHeight: 200 },
  slides: { title: 'Presentation', subtitle: 'deck / speaker notes', surfaceAlpha: 0.082, lineAlpha: 0.15, minWidth: 280, minHeight: 200 },
  'trading-graph': { title: 'Trading graph', subtitle: 'market curves', surfaceAlpha: 0.09, lineAlpha: 0.17, minWidth: 300, minHeight: 180 },
  image: { title: 'Image preview', subtitle: 'preview / annotate', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 240, minHeight: 190 },
  pdf: { title: 'PDF', subtitle: 'read / scan / print', surfaceAlpha: 0.08, lineAlpha: 0.14, minWidth: 260, minHeight: 200 },
  video: { title: 'Media frame', subtitle: 'preview panel', surfaceAlpha: 0.082, lineAlpha: 0.14, minWidth: 260, minHeight: 170 },
  '3d': { title: 'Preview', subtitle: 'files / models', surfaceAlpha: 0.1, lineAlpha: 0.16, minWidth: 300, minHeight: 190 },
  '3d-studio': { title: '3D studio', subtitle: 'gesture / simulate / sculpt', surfaceAlpha: 0.11, lineAlpha: 0.18, minWidth: 360, minHeight: 240 },
  flow: { title: 'Workflows', subtitle: 'library / steps / pdf', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 300, minHeight: 220 },
  list: { title: 'List', subtitle: 'inbox / next steps', surfaceAlpha: 0.075, lineAlpha: 0.14, minWidth: 260, minHeight: 150 },
  'command-inbox': { title: 'Command inbox', subtitle: 'approvals / gates', surfaceAlpha: 0.088, lineAlpha: 0.17, minWidth: 320, minHeight: 240 },
  notifications: { title: 'Notifications', subtitle: 'telemetry / alerts', surfaceAlpha: 0.082, lineAlpha: 0.16, minWidth: 320, minHeight: 240 },
  'integration-registry': { title: 'Integration registry', subtitle: 'devices / permissions', surfaceAlpha: 0.084, lineAlpha: 0.16, minWidth: 340, minHeight: 260 },
  'agent-control': { title: 'Agent control', subtitle: 'identity / jobs / permissions', surfaceAlpha: 0.086, lineAlpha: 0.17, minWidth: 360, minHeight: 280 },
  'agent-console': { title: 'Agent proposals', subtitle: 'tasks / command cards', surfaceAlpha: 0.088, lineAlpha: 0.17, minWidth: 360, minHeight: 300 },
  'hermes-hud': { title: 'Hermes HUD', subtitle: 'chat / voice / direct control', surfaceAlpha: 0.09, lineAlpha: 0.18, minWidth: 380, minHeight: 340 },
  'home-systems': { title: 'Home systems', subtitle: 'energy / safety / automation', surfaceAlpha: 0.086, lineAlpha: 0.17, minWidth: 360, minHeight: 300 },
  goals: { title: 'Goals', subtitle: 'objectives / evidence / audit', surfaceAlpha: 0.088, lineAlpha: 0.17, minWidth: 360, minHeight: 300 },
  'app-portal': { title: 'App Portal', subtitle: 'embedded tools / launch', surfaceAlpha: 0.084, lineAlpha: 0.16, minWidth: 360, minHeight: 300 },
  'json-surface': { title: 'JSON Surface', subtitle: 'agent data / renderer', surfaceAlpha: 0.086, lineAlpha: 0.16, minWidth: 360, minHeight: 300 },
};

type WidgetPresetLayout = Pick<WorkspaceWidget, 'id' | 'kind' | 'x' | 'y' | 'width' | 'height' | 'zIndex'> &
  Partial<Pick<WorkspaceWidget, 'title' | 'subtitle' | 'minWidth' | 'minHeight' | 'pinned' | 'previewFileId'>>;

const widgetPresetLayouts: WidgetPresetLayout[] = [
  { id: 'overview', kind: 'overview', x: 44, y: 74, width: 390, height: 248, zIndex: 6, pinned: true },
  { id: 'telemetry', kind: 'graph', x: 264, y: 88, width: 350, height: 220, zIndex: 5 },
  { id: 'market-telemetry', kind: 'trading-graph', x: 620, y: 90, width: 378, height: 224, zIndex: 5 },
  { id: 'preview', kind: '3d', x: 528, y: 66, width: 426, height: 258, zIndex: 4, previewFileId: null },
  { id: 'map', kind: 'map', x: 246, y: 286, width: 300, height: 218, zIndex: 3 },
  { id: 'flow', kind: 'flow', x: 560, y: 318, width: 680, height: 420, zIndex: 2, minWidth: 320, minHeight: 320 },
  { id: 'news', kind: 'news', x: 872, y: 94, width: 274, height: 194, zIndex: 1 },
  { id: 'schedule', kind: 'schedule', x: 914, y: 308, width: 292, height: 206, zIndex: 2 },
  { id: 'launcher', kind: 'launcher', x: 586, y: 530, width: 310, height: 194, zIndex: 3 },
  { id: 'watch-video', kind: 'watch-video', x: 986, y: 536, width: 276, height: 180, zIndex: 2 },
  { id: 'file-explorer', kind: 'file-explorer', x: 60, y: 330, width: 380, height: 420, zIndex: 3, minWidth: 360, minHeight: 380 },
  { id: 'native-app', kind: 'native-app', x: 420, y: 320, width: 392, height: 238, zIndex: 4 },
  { id: 'window-manager', kind: 'window-manager', x: 840, y: 332, width: 344, height: 238, zIndex: 4 },
  { id: 'command-inbox', kind: 'command-inbox', x: 24, y: 86, width: 390, height: 360, zIndex: 8, pinned: true },
  { id: 'notifications', kind: 'notifications', x: 430, y: 86, width: 360, height: 300, zIndex: 7 },
  { id: 'integration-registry', kind: 'integration-registry', x: 808, y: 86, width: 390, height: 340, zIndex: 6 },
  { id: 'agent-control', kind: 'agent-control', x: 430, y: 404, width: 390, height: 360, zIndex: 6 },
  { id: 'agent-console', kind: 'agent-console', x: 836, y: 444, width: 390, height: 360, zIndex: 6 },
  { id: 'hermes-hud', kind: 'hermes-hud', x: 1242, y: 444, width: 410, height: 380, zIndex: 6 },
  { id: 'home-systems', kind: 'home-systems', x: 24, y: 772, width: 430, height: 360, zIndex: 5 },
  { id: 'goals', kind: 'goals', x: 24, y: 1148, width: 430, height: 380, zIndex: 5 },
  { id: 'app-portal', kind: 'app-portal', x: 470, y: 1148, width: 430, height: 380, zIndex: 4 },
  { id: 'json-surface', kind: 'json-surface', x: 916, y: 1148, width: 430, height: 380, zIndex: 4 },
  { id: 'sheet', kind: 'sheet', x: 120, y: 772, width: 408, height: 246, zIndex: 2 },
  { id: 'docs', kind: 'docs', x: 548, y: 786, width: 342, height: 232, zIndex: 2 },
  { id: 'slides', kind: 'slides', x: 912, y: 790, width: 330, height: 230, zIndex: 2 },
  { id: 'image', kind: 'image', x: 1260, y: 778, width: 286, height: 224, zIndex: 2 },
  { id: 'pdf', kind: 'pdf', x: 1580, y: 782, width: 300, height: 224, zIndex: 2 },
  { id: 'audio', kind: 'audio', x: 60, y: 548, width: 344, height: 194, zIndex: 2 },
  { id: 'list', kind: 'list', title: 'Project list', subtitle: 'tasks / backlog', x: 418, y: 568, width: 332, height: 174, zIndex: 1 },
];

export const widgetPresets: WorkspaceWidget[] = widgetPresetLayouts.map((layout) => {
  const blueprint = widgetBlueprints[layout.kind];

  return {
    id: layout.id,
    kind: layout.kind,
    title: layout.title ?? blueprint.title,
    subtitle: layout.subtitle ?? blueprint.subtitle,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    zIndex: layout.zIndex,
    surfaceAlpha: blueprint.surfaceAlpha,
    lineAlpha: blueprint.lineAlpha,
    open: true,
    minWidth: layout.minWidth ?? blueprint.minWidth,
    minHeight: layout.minHeight ?? blueprint.minHeight,
    pinned: layout.pinned,
    previewFileId: layout.previewFileId,
  };
});

export function getWidgetLabel(kind: WorkspaceWidget['kind']) {
  return widgetBlueprints[kind].title;
}

export function getWorkspaceLauncherEntries(role?: ShellRole, permissions?: WorkspaceWidgetPermissionMatrix): WorkspaceLauncherEntry[] {
  const kinds = role ? workspaceLauncherKinds.filter((kind) => isWorkspaceWidgetAllowedForRole(kind, role, permissions)) : workspaceLauncherKinds;

  return kinds.map((kind) => ({
    kind,
    note: workspaceLauncherNotes[kind] ?? 'open in workspace',
  }));
}

export function getFocusedWidget(kind: WorkspaceWidget['kind'], width: number, height: number): WorkspaceWidget {
  const blueprint = widgetBlueprints[kind];

  return {
    id: `panel-${kind}`,
    kind,
    title: blueprint.title,
    subtitle: blueprint.subtitle,
    x: 16,
    y: 84,
    width: Math.max(320, width - 32),
    height: Math.max(220, height - 104),
    zIndex: 9,
    surfaceAlpha: blueprint.surfaceAlpha,
    lineAlpha: blueprint.lineAlpha,
    open: true,
    minWidth: blueprint.minWidth,
    minHeight: blueprint.minHeight,
    pinned: true,
  };
}
