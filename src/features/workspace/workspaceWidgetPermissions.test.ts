import { beforeEach, describe, expect, it } from 'vitest';

import {
  getDefaultWorkspaceWidgetPermission,
  isWorkspaceWidgetPermittedByPolicy,
  loadWorkspaceWidgetPermissions,
  resetWorkspaceWidgetPermissionRole,
  updateWorkspaceWidgetPermission,
} from './workspaceWidgetPermissions';

describe('workspace widget permissions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps admin unrestricted while hiding agent tools from guests by default', () => {
    const permissions = loadWorkspaceWidgetPermissions();

    expect(isWorkspaceWidgetPermittedByPolicy('agent-control', 'admin', permissions)).toBe(true);
    expect(getDefaultWorkspaceWidgetPermission('agent-control', 'guest')).toBe(false);
    expect(isWorkspaceWidgetPermittedByPolicy('home-systems', 'guest', permissions)).toBe(true);
  });

  it('persists role-specific widget permission changes', () => {
    const permissions = updateWorkspaceWidgetPermission(loadWorkspaceWidgetPermissions(), 'guest', 'home-systems', false);

    expect(isWorkspaceWidgetPermittedByPolicy('home-systems', 'guest', permissions)).toBe(false);
    expect(isWorkspaceWidgetPermittedByPolicy('home-systems', 'guest', loadWorkspaceWidgetPermissions())).toBe(false);
  });

  it('resets a role back to default widget permissions', () => {
    const changed = updateWorkspaceWidgetPermission(loadWorkspaceWidgetPermissions(), 'guest', 'home-systems', false);
    const reset = resetWorkspaceWidgetPermissionRole(changed, 'guest');

    expect(isWorkspaceWidgetPermittedByPolicy('home-systems', 'guest', reset)).toBe(true);
    expect(isWorkspaceWidgetPermittedByPolicy('home-systems', 'guest', loadWorkspaceWidgetPermissions())).toBe(true);
  });
});
