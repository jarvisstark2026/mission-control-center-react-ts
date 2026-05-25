import type { ShellRole } from '../shell/roles';
import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';
import { isWorkspaceWidgetKind, type WorkspaceWidget, workspaceWidgetKinds } from './workspaceTypes';

export type WorkspaceWidgetPermissionMatrix = Record<ShellRole, Partial<Record<WorkspaceWidget['kind'], boolean>>>;

export const editableWorkspacePermissionRoles: ShellRole[] = ['home', 'support', 'guest'];

const workspaceWidgetPermissionsStorageKey = 'mission-control-center.workspace.widget-permissions.v1';
const defaultDeniedWidgetRoles: Partial<Record<WorkspaceWidget['kind'], ShellRole[]>> = {
  'agent-control': ['guest'],
  'agent-console': ['guest'],
  'json-surface': ['guest'],
};

export function getDefaultWorkspaceWidgetPermission(kind: WorkspaceWidget['kind'], role: ShellRole) {
  if (role === 'admin') return true;
  return !(defaultDeniedWidgetRoles[kind]?.includes(role) ?? false);
}

function createEmptyPermissionMatrix(): WorkspaceWidgetPermissionMatrix {
  return {
    admin: {},
    home: {},
    support: {},
    guest: {},
  };
}

export function loadWorkspaceWidgetPermissions(): WorkspaceWidgetPermissionMatrix {
  const parsed = readLocalStorageJson<Partial<Record<ShellRole, Partial<Record<string, unknown>>>>>(workspaceWidgetPermissionsStorageKey);
  const permissions = createEmptyPermissionMatrix();
  if (!parsed || typeof parsed !== 'object') return permissions;

  for (const role of editableWorkspacePermissionRoles) {
    const rolePermissions = parsed[role];
    if (!rolePermissions || typeof rolePermissions !== 'object') continue;

    for (const [kind, allowed] of Object.entries(rolePermissions)) {
      if (isWorkspaceWidgetKind(kind) && typeof allowed === 'boolean') {
        permissions[role][kind] = allowed;
      }
    }
  }

  return permissions;
}

export function saveWorkspaceWidgetPermissions(permissions: WorkspaceWidgetPermissionMatrix) {
  return writeLocalStorageJson(workspaceWidgetPermissionsStorageKey, permissions);
}

export function isWorkspaceWidgetPermittedByPolicy(
  kind: WorkspaceWidget['kind'],
  role: ShellRole,
  permissions: WorkspaceWidgetPermissionMatrix,
) {
  if (role === 'admin') return true;
  return permissions[role][kind] ?? getDefaultWorkspaceWidgetPermission(kind, role);
}

export function updateWorkspaceWidgetPermission(
  permissions: WorkspaceWidgetPermissionMatrix,
  role: ShellRole,
  kind: WorkspaceWidget['kind'],
  allowed: boolean,
): WorkspaceWidgetPermissionMatrix {
  if (role === 'admin' || !workspaceWidgetKinds.includes(kind)) return permissions;

  const next = {
    ...permissions,
    [role]: {
      ...permissions[role],
      [kind]: allowed,
    },
  };
  saveWorkspaceWidgetPermissions(next);
  return next;
}

export function resetWorkspaceWidgetPermissionRole(
  permissions: WorkspaceWidgetPermissionMatrix,
  role: ShellRole,
): WorkspaceWidgetPermissionMatrix {
  if (role === 'admin') return permissions;

  const next = {
    ...permissions,
    [role]: {},
  };
  saveWorkspaceWidgetPermissions(next);
  return next;
}
