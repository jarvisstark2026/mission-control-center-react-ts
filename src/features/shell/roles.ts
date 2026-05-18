export type ShellRole = 'admin' | 'home' | 'guest' | 'support';

export type ShellScope = {
  id: ShellRole;
  label: string;
  description: string;
};

export const shellScopes: ShellScope[] = [
  {
    id: 'admin',
    label: 'Admin',
    description: 'Full control over command surfaces and system state.',
  },
  {
    id: 'home',
    label: 'Home user',
    description: 'Everyday operations with household-safe visibility.',
  },
  {
    id: 'guest',
    label: 'Guest',
    description: 'Minimal surface area and read-only presentation.',
  },
  {
    id: 'support',
    label: 'Support',
    description: 'Diagnostics, status, and repair-oriented visibility.',
  },
];

export function isShellRole(value: string): value is ShellRole {
  return shellScopes.some((scope) => scope.id === value);
}