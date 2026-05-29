import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createWorkspaceLayoutSnapshot,
  pauseAllAgentLiveLayoutWorkspaces,
  readAgentLiveLayoutGlobalState,
  reportAgentLiveLayoutWorkspaceStatus,
  requestWorkspaceLayoutPlan,
  setAgentLiveLayoutWorkspaceEnabled,
  setAllAgentLiveLayoutWorkspacesEnabled,
  validateWorkspaceLayoutDirectives,
  type WorkspaceLayoutDirective,
} from './workspaceAgentLayout';
import type { WorkspaceWidget } from './workspaceTypes';

function createWidget(patch: Partial<WorkspaceWidget> = {}): WorkspaceWidget {
  return {
    id: 'command-core',
    kind: 'command-inbox',
    title: 'Command Inbox',
    subtitle: 'Approvals',
    x: 20,
    y: 30,
    width: 390,
    height: 360,
    zIndex: 2,
    surfaceAlpha: 0.1,
    lineAlpha: 0.2,
    open: true,
    minWidth: 320,
    minHeight: 240,
    ...patch,
  };
}

describe('workspace agent layout control', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps live layout toggles separated by workspace placement', () => {
    setAgentLiveLayoutWorkspaceEnabled('center', 'main', true, 'http://127.0.0.1:8787');

    const state = readAgentLiveLayoutGlobalState();

    expect(state.workspaces.center.enabled).toBe(true);
    expect(state.workspaces.center.status).toBe('listening');
    expect(state.workspaces.left.enabled).toBe(false);
    expect(state.workspaces['top-left'].enabled).toBe(false);
  });

  it('supports enable all, pause all, and workspace status reports', () => {
    setAllAgentLiveLayoutWorkspacesEnabled(true, 'http://127.0.0.1:8787');
    reportAgentLiveLayoutWorkspaceStatus('left', 'workspace-left', {
      status: 'moving',
      activeWidgetIds: ['command-core'],
      lastDirectiveAt: '2026-05-28T12:00:00.000Z',
    });

    let state = readAgentLiveLayoutGlobalState();
    expect(Object.values(state.workspaces).every((workspace) => workspace.enabled)).toBe(true);
    expect(state.workspaces.left).toMatchObject({
      workspaceId: 'workspace-left',
      status: 'moving',
      activeWidgetIds: ['command-core'],
    });

    pauseAllAgentLiveLayoutWorkspaces('http://127.0.0.1:8787');
    state = readAgentLiveLayoutGlobalState();
    expect(Object.values(state.workspaces).every((workspace) => !workspace.enabled)).toBe(true);
    expect(state.workspaces.center.status).toBe('paused by user');
  });

  it('accepts valid directives and clamps geometry to the canvas', () => {
    const snapshot = createWorkspaceLayoutSnapshot({
      workspaceId: 'main',
      canvas: { width: 800, height: 600 },
      widgets: [createWidget()],
      locks: { agentAnimatingWidgetIds: [] },
    });
    const directive: WorkspaceLayoutDirective = {
      id: 'move-command',
      workspaceId: 'main',
      widgetId: 'command-core',
      action: 'move-resize',
      target: { x: 760, y: 580, width: 500, height: 420 },
      durationMs: 5000,
    };

    const result = validateWorkspaceLayoutDirectives([directive], snapshot);

    expect(result.rejected).toHaveLength(0);
    expect(result.accepted[0]).toMatchObject({
      widgetId: 'command-core',
      durationMs: 1600,
      target: {
        x: 300,
        y: 180,
        width: 500,
        height: 420,
      },
    });
  });

  it('rejects pinned, hidden, unknown, and user-locked widgets', () => {
    const snapshot = createWorkspaceLayoutSnapshot({
      workspaceId: 'main',
      canvas: { width: 800, height: 600 },
      widgets: [
        createWidget({ id: 'pinned', pinned: true }),
        createWidget({ id: 'hidden', hidden: true }),
        createWidget({ id: 'locked' }),
      ],
      locks: { userDraggingWidgetId: 'locked', agentAnimatingWidgetIds: [] },
    });
    const directives: WorkspaceLayoutDirective[] = [
      { id: 'one', workspaceId: 'main', widgetId: 'pinned', action: 'move', target: { x: 80, y: 80 } },
      { id: 'two', workspaceId: 'main', widgetId: 'hidden', action: 'move', target: { x: 80, y: 80 } },
      { id: 'three', workspaceId: 'main', widgetId: 'locked', action: 'move', target: { x: 80, y: 80 } },
      { id: 'four', workspaceId: 'main', widgetId: 'missing', action: 'move', target: { x: 80, y: 80 } },
    ];

    const result = validateWorkspaceLayoutDirectives(directives, snapshot);

    expect(result.accepted).toHaveLength(0);
    expect(result.rejected.join('\n')).toContain('pinned widget');
    expect(result.rejected.join('\n')).toContain('hidden widget');
    expect(result.rejected.join('\n')).toContain('locked by the user');
    expect(result.rejected.join('\n')).toContain('unknown widget');
  });

  it('requests bridge directives from the live layout endpoint', async () => {
    const snapshot = createWorkspaceLayoutSnapshot({
      workspaceId: 'main',
      canvas: { width: 800, height: 600 },
      widgets: [createWidget()],
      locks: { agentAnimatingWidgetIds: [] },
    });
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ directives: [{ id: 'focus', workspaceId: 'main', widgetId: 'command-core', action: 'focus' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const directives = await requestWorkspaceLayoutPlan('http://127.0.0.1:8787/', snapshot, fetchImpl as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8787/workspace/layout/plan', expect.objectContaining({ method: 'POST' }));
    expect(directives).toHaveLength(1);
    expect(directives[0]).toMatchObject({ action: 'focus', widgetId: 'command-core' });
  });
});
