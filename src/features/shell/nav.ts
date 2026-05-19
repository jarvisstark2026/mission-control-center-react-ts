import type { ShellRole } from './roles';

export type ShellNavItem = {
  id: string;
  label: string;
  hint: string;
  allowedRoles: ShellRole[];
};

export const shellNavItems: ShellNavItem[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    hint: 'open surfaces and moving panels',
    allowedRoles: ['admin', 'home', 'guest', 'support'],
  },
  {
    id: 'telemetry',
    label: 'Telemetry',
    hint: 'live system readouts',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    hint: 'gated actions and queue review',
    allowedRoles: ['admin', 'support'],
  },
  {
    id: 'registry',
    label: 'Registry',
    hint: 'devices, integrations, and scopes',
    allowedRoles: ['admin', 'support'],
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
    label: 'Watch video',
    hint: 'player and playback',
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
    id: 'window-manager',
    label: 'Window manager',
    hint: 'open surfaces and routing',
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
    label: 'Image',
    hint: 'preview and annotate',
    allowedRoles: ['admin', 'home', 'support'],
  },
  {
    id: 'pdf',
    label: 'PDF',
    hint: 'read and scan documents',
    allowedRoles: ['admin', 'home', 'support'],
  },
];

export function getVisibleShellNavItems(role: ShellRole) {
  return shellNavItems.filter((item) => item.allowedRoles.includes(role));
}