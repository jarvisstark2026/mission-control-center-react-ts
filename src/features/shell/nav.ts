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
];

export function getVisibleShellNavItems(role: ShellRole) {
  return shellNavItems.filter((item) => item.allowedRoles.includes(role));
}