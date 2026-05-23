import { beforeEach, describe, expect, it } from 'vitest';

import {
  getDefaultWorkspaceWidgetPermission,
  isWorkspaceWidgetPermittedByPolicy,
  loadWorkspaceWidgetPermissions,
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
});
