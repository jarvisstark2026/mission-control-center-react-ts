import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canCreateWorkspaceExtensionInstance,
  getAdjacentWorkspaceInstance,
  getCurrentWorkspaceId,
  getWorkspaceInstances,
  maxWorkspaceExtensionInstances,
  markCurrentWorkspaceExtensionClosed,
  markCurrentWorkspaceExtensionOpen,
  pruneClosedWorkspaceInstances,
  registerWorkspaceExtensionInstance,
  updateWorkspaceInstancePlacement,
} from './workspaceInstances';

describe('workspace instance registry', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?role=admin');
  });

  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?role=admin');
    vi.useRealTimers();
  });

  it('removes fallback extension entries when an extension route closes without an id', () => {
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');

    markCurrentWorkspaceExtensionOpen();

    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(1);

    markCurrentWorkspaceExtensionClosed();

    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(0);
  });

  it('prunes registered popup instances after their window closes', () => {
    const popupState = { closed: false };
    const popup = popupState as unknown as Window;

    registerWorkspaceExtensionInstance({
      id: 'workspace-1',
      popup,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-1',
    });

    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(1);

    popupState.closed = true;

    expect(pruneClosedWorkspaceInstances()).toBe(true);
    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(0);
  });

  it('assigns and updates extension workspace placement', () => {
    expect(registerWorkspaceExtensionInstance({
      id: 'workspace-1',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-1',
    })).toBe(true);

    expect(getWorkspaceInstances().find((instance) => instance.id === 'workspace-1')?.placement).toBe('right');
    expect(updateWorkspaceInstancePlacement('workspace-1', 'bottom-right')).toBe(true);
    expect(getWorkspaceInstances().find((instance) => instance.id === 'workspace-1')?.placement).toBe('bottom-right');
  });

  it('swaps occupied extension workspace placements', () => {
    registerWorkspaceExtensionInstance({
      id: 'workspace-1',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-1',
    });
    registerWorkspaceExtensionInstance({
      id: 'workspace-2',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-2',
    });

    expect(getWorkspaceInstances().find((instance) => instance.id === 'workspace-1')?.placement).toBe('right');
    expect(getWorkspaceInstances().find((instance) => instance.id === 'workspace-2')?.placement).toBe('left');

    updateWorkspaceInstancePlacement('workspace-1', 'left');

    expect(getWorkspaceInstances().find((instance) => instance.id === 'workspace-1')?.placement).toBe('left');
    expect(getWorkspaceInstances().find((instance) => instance.id === 'workspace-2')?.placement).toBe('right');
  });

  it('moves the main workspace and swaps with occupied slots', () => {
    registerWorkspaceExtensionInstance({
      id: 'workspace-1',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-1',
    });
    registerWorkspaceExtensionInstance({
      id: 'workspace-2',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-2',
    });

    expect(updateWorkspaceInstancePlacement('main', 'left')).toBe(true);
    expect(getWorkspaceInstances().find((instance) => instance.id === 'main')?.placement).toBe('left');
    expect(getWorkspaceInstances().find((instance) => instance.id === 'workspace-2')?.placement).toBe('center');

    expect(updateWorkspaceInstancePlacement('workspace-1', 'left')).toBe(true);
    expect(getWorkspaceInstances().find((instance) => instance.id === 'workspace-1')?.placement).toBe('left');
    expect(getWorkspaceInstances().find((instance) => instance.id === 'main')?.placement).toBe('right');
  });

  it('resolves adjacent workspaces from the current extended layout', () => {
    registerWorkspaceExtensionInstance({
      id: 'workspace-right',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-right',
    });
    registerWorkspaceExtensionInstance({
      id: 'workspace-left',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-left',
    });
    updateWorkspaceInstancePlacement('main', 'center');
    updateWorkspaceInstancePlacement('workspace-right', 'right');
    updateWorkspaceInstancePlacement('workspace-left', 'left');

    expect(getCurrentWorkspaceId()).toBe('main');
    expect(getAdjacentWorkspaceInstance('main', 'right')?.id).toBe('workspace-right');
    expect(getAdjacentWorkspaceInstance('main', 'left')?.id).toBe('workspace-left');
    expect(getAdjacentWorkspaceInstance('workspace-right', 'left')?.id).toBe('main');
    expect(getAdjacentWorkspaceInstance('workspace-right', 'right')).toBeNull();
  });

  it('supports eight extension workspaces around the main workspace', () => {
    for (let index = 0; index < maxWorkspaceExtensionInstances; index += 1) {
      expect(registerWorkspaceExtensionInstance({
        id: `workspace-${index}`,
        popup: null,
        url: `http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-${index}`,
      })).toBe(true);
    }

    expect(canCreateWorkspaceExtensionInstance()).toBe(false);
    expect(registerWorkspaceExtensionInstance({
      id: 'workspace-over-limit',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-over-limit',
    })).toBe(false);
    expect(getWorkspaceInstances()).toHaveLength(9);
    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(8);
  });

  it('prunes legacy stored instances that no longer have a live heartbeat', () => {
    window.localStorage.setItem(
      'mission-control.workspace-instances',
      JSON.stringify([
        {
          id: 'workspace-legacy',
          label: 'Workspace instance',
          url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-legacy',
          openedAt: 1,
        },
      ]),
    );

    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(1);

    expect(pruneClosedWorkspaceInstances()).toBe(true);
    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(0);
  });

  it('keeps recent heartbeat instances that do not have a popup handle yet', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T00:00:00Z'));

    registerWorkspaceExtensionInstance({
      id: 'workspace-recent',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-recent',
    });

    expect(pruneClosedWorkspaceInstances()).toBe(false);
    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(1);

    vi.advanceTimersByTime(6001);

    expect(pruneClosedWorkspaceInstances()).toBe(true);
    expect(getWorkspaceInstances().filter((instance) => instance.kind === 'extension')).toHaveLength(0);
  });
});
