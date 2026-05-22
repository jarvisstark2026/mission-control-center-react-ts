import type { WidgetKind } from '../workspace/workspaceTypes';
import type { ShellRole } from './roles';

export type ShellNavItem = {
  id: string;
  label: string;
  hint: string;
  allowedRoles: ShellRole[];
  panelKind?: WidgetKind | null;
};

export const shellNavItems: ShellNavItem[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    hint: 'open surfaces and moving panels',
    allowedRoles: ['admin', 'home', 'guest', 'support'],
    panelKind: null,
  },
  {
    id: 'telemetry',
    label: 'Telemetry',
    hint: 'live system readouts',
    allowedRoles: ['admin', 'home', 'support'],
    panelKind: 'graph',
  },
  {
    id: 'map',
    label: 'Map / routes',
    hint: 'locations and zones',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'project',
    label: 'Project list',
    hint: 'tasks, review, and deploy',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'manager',
    label: 'Manager',
    hint: 'visible widgets, state, and focus',
    allowedRoles: ['admin', 'support'],
    panelKind: 'window-manager',
  },
  {
    id: 'command-inbox',
    label: 'Command inbox',
    hint: 'approval gates and blocked actions',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    hint: 'live telemetry and alerts',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'home-systems',
    label: 'Home systems',
    hint: 'energy, safety, and home automation',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'integration-registry',
    label: 'Integration registry',
    hint: 'devices, heartbeats, and permissions',
    allowedRoles: ['admin', 'support'],
  },
  {
    id: 'agent-control',
    label: 'Agent control',
    hint: 'agent identity, jobs, usage, and permissions',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'agent-console',
    label: 'Agent console',
    hint: 'task Jarvis and stage proposals',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    hint: 'day blocks and next actions',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'launcher',
    label: 'App launcher',
    hint: 'spawn desktop windows',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'browser',
    label: 'Browser',
    hint: 'pages and tabs',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'watch-video',
    label: 'Live TV',
    hint: 'official streams and local tuners',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'video',
    label: 'Media frame',
    hint: 'preview panel',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'audio',
    label: 'Audio preview',
    hint: 'hold, play, and mix',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'diagram',
    label: 'Diagram preview',
    hint: 'system structure',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'news',
    label: 'Markets',
    hint: 'custom graph library and watchlist',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'flow',
    label: 'Workflows',
    hint: 'workflow library and PDF handouts',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: '3d',
    label: 'Preview',
    hint: 'files and project models',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'list',
    label: 'List',
    hint: 'inbox and next steps',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'file-explorer',
    label: 'File explorer',
    hint: 'folders and files',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'native-app',
    label: 'Native app bridge',
    hint: 'installed apps and external windows',
    allowedRoles: ['admin', 'support'],
  },
  {
    id: 'sheet',
    label: 'Spreadsheet',
    hint: 'cells and formulas',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'docs',
    label: 'Docs',
    hint: 'writing and outline',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'slides',
    label: 'Presentation',
    hint: 'deck and speaking notes',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'trading-graph',
    label: 'Trading graph',
    hint: 'market curves and price action',
    allowedRoles: ['admin', 'support'],
  },
  {
    id: 'image',
    label: 'Image preview',
    hint: 'preview and annotate',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'pdf',
    label: 'PDF',
    hint: 'read and scan documents',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: '3d-studio',
    label: '3D studio',
    hint: 'gesture sculpting and engineering sims',
    allowedRoles: ['admin', 'home', 'support'],
  },
];

export function getVisibleShellNavItems(role: ShellRole) {
  return shellNavItems.filter((item) => item.allowedRoles.includes(role));
}

export function getShellNavPanelKind(item: ShellNavItem): WidgetKind | null {
  return item.panelKind === undefined ? (item.id as WidgetKind) : item.panelKind;
}

export function isShellPanelAccessible(role: ShellRole, panelKind: string | null | undefined) {
  if (!panelKind) return false;

  return shellNavItems.some((item) => getShellNavPanelKind(item) === panelKind && item.allowedRoles.includes(role));
}
