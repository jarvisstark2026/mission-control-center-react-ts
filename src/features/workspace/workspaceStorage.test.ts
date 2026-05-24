import { beforeEach, describe, expect, it } from 'vitest';

import { workspacePersistenceChangeEventName } from './workspacePersistence';
import { widgetBlueprints, widgetPresets } from './workspaceWidgetCatalog';
import {
  clearAllStoredWidgetStates,
  getWorkspaceModeWidgetStorageKey,
  getWorkspaceWidgetStorageKey,
  hasStoredWidgetState,
  loadStoredWidgetState,
  saveStoredWidgetState,
  subscribeStoredWidgetState,
  workspaceStorageKey,
} from './workspaceStorage';
import type { WorkspaceWidget } from './workspaceTypes';

const defaultOpenKinds = new Set<WorkspaceWidget['kind']>(['overview']);

describe('workspace storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips serializable widget layout state', () => {
    const [firstWidget] = widgetPresets;
    const savedWidget = { ...firstWidget, x: 120, y: 140, width: 500, height: 320, open: false };

    expect(saveStoredWidgetState([savedWidget])).toBe(true);

    const restored = loadStoredWidgetState({
      presets: widgetPresets,
      defaultOpenKinds,
      blueprints: widgetBlueprints,
    });

    const restoredWidget = restored?.find((widget) => widget.id === savedWidget.id);
    expect(restoredWidget).toMatchObject({
      id: savedWidget.id,
      x: 120,
      y: 140,
      width: 500,
      height: 320,
      open: false,
    });
  });

  it('stores widget layout state separately for each workspace', () => {
    const [firstWidget] = widgetPresets;
    const mainWidget = { ...firstWidget, x: 120 };
    const extensionWidget = { ...firstWidget, x: 640 };

    expect(saveStoredWidgetState([mainWidget], 'main')).toBe(true);
    expect(saveStoredWidgetState([extensionWidget], 'workspace-1')).toBe(true);

    expect(window.localStorage.getItem(workspaceStorageKey)).not.toBeNull();
    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-1'))).not.toBeNull();

    const restoredMain = loadStoredWidgetState({
      presets: widgetPresets,
      defaultOpenKinds,
      blueprints: widgetBlueprints,
      workspaceId: 'main',
    });
    const restoredExtension = loadStoredWidgetState({
      presets: widgetPresets,
      defaultOpenKinds,
      blueprints: widgetBlueprints,
      workspaceId: 'workspace-1',
    });

    expect(restoredMain?.find((widget) => widget.id === firstWidget.id)?.x).toBe(120);
    expect(restoredExtension?.find((widget) => widget.id === firstWidget.id)?.x).toBe(640);
  });

  it('notifies workspace widget subscribers when a desktop persistence change arrives', () => {
    let notificationCount = 0;
    const workspaceId = 'workspace-1';
    const storageKey = getWorkspaceWidgetStorageKey(workspaceId);
    const unsubscribe = subscribeStoredWidgetState(workspaceId, () => {
      notificationCount += 1;
    });

    window.dispatchEvent(
      new CustomEvent(workspacePersistenceChangeEventName, {
        detail: { key: storageKey, action: 'write', value: '[]' },
      }),
    );
    window.dispatchEvent(
      new CustomEvent(workspacePersistenceChangeEventName, {
        detail: { key: getWorkspaceWidgetStorageKey('workspace-2'), action: 'write', value: '[]' },
      }),
    );

    unsubscribe();

    expect(notificationCount).toBe(1);
  });

  it('stores explicit mode layouts separately from the last working workspace layout', () => {
    const [firstWidget] = widgetPresets;
    const workingWidget = { ...firstWidget, x: 120 };
    const modeWidget = { ...firstWidget, x: 720 };

    expect(saveStoredWidgetState([workingWidget], 'workspace-1')).toBe(true);
    expect(saveStoredWidgetState([modeWidget], 'workspace-1', 'security')).toBe(true);

    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-1'))).not.toBeNull();
    expect(window.localStorage.getItem(getWorkspaceModeWidgetStorageKey('workspace-1', 'security'))).not.toBeNull();
    expect(hasStoredWidgetState('workspace-1')).toBe(true);
    expect(hasStoredWidgetState('workspace-1', 'security')).toBe(true);

    const restoredWorking = loadStoredWidgetState({
      presets: widgetPresets,
      defaultOpenKinds,
      blueprints: widgetBlueprints,
      workspaceId: 'workspace-1',
    });
    const restoredMode = loadStoredWidgetState({
      presets: widgetPresets,
      defaultOpenKinds,
      blueprints: widgetBlueprints,
      workspaceId: 'workspace-1',
      modeId: 'security',
      fallbackToWorkspace: false,
    });

    expect(restoredWorking?.find((widget) => widget.id === firstWidget.id)?.x).toBe(120);
    expect(restoredMode?.find((widget) => widget.id === firstWidget.id)?.x).toBe(720);
  });

  it('clears main, registered, and stale workspace layout keys together', () => {
    const [firstWidget] = widgetPresets;

    expect(saveStoredWidgetState([{ ...firstWidget, x: 120 }], 'main')).toBe(true);
    expect(saveStoredWidgetState([{ ...firstWidget, x: 640 }], 'workspace-1')).toBe(true);
    expect(saveStoredWidgetState([{ ...firstWidget, x: 720 }], 'workspace-1', 'security')).toBe(true);
    expect(saveStoredWidgetState([{ ...firstWidget, x: 840 }], 'stale-workspace')).toBe(true);

    expect(clearAllStoredWidgetStates(['main', 'workspace-1'])).toBe(true);

    expect(window.localStorage.getItem(workspaceStorageKey)).toBeNull();
    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-1'))).toBeNull();
    expect(window.localStorage.getItem(getWorkspaceModeWidgetStorageKey('workspace-1', 'security'))).toBeNull();
    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('stale-workspace'))).toBeNull();
  });

  it('normalizes invalid persisted layout values back into safe bounds', () => {
    window.localStorage.setItem(
      workspaceStorageKey,
      JSON.stringify([
        {
          id: 'overview',
          kind: 'overview',
          width: -10,
          height: 99999,
          x: -99999,
          y: 99999,
          zIndex: 99999,
          surfaceAlpha: 5,
          lineAlpha: -5,
        },
      ]),
    );

    const restored = loadStoredWidgetState({
      presets: widgetPresets,
      defaultOpenKinds,
      blueprints: widgetBlueprints,
    });
    const overview = restored?.find((widget) => widget.id === 'overview');

    expect(overview?.width).toBeGreaterThanOrEqual(overview?.minWidth ?? 0);
    expect(overview?.height).toBeLessThanOrEqual(4096);
    expect(overview?.x).toBe(-8192);
    expect(overview?.y).toBe(8192);
    expect(overview?.zIndex).toBe(999);
    expect(overview?.surfaceAlpha).toBe(1);
    expect(overview?.lineAlpha).toBe(0);
  });

  it('keeps restored open widgets inside the top edge of the canvas', () => {
    window.localStorage.setItem(
      workspaceStorageKey,
      JSON.stringify([
        {
          id: 'overview',
          kind: 'overview',
          open: true,
          y: -220,
        },
        {
          id: 'telemetry',
          kind: 'graph',
          open: false,
          y: -180,
        },
      ]),
    );

    const restored = loadStoredWidgetState({
      presets: widgetPresets,
      defaultOpenKinds,
      blueprints: widgetBlueprints,
    });

    expect(restored?.find((widget) => widget.id === 'overview')?.y).toBe(0);
    expect(restored?.find((widget) => widget.id === 'telemetry')?.y).toBe(-180);
  });

  it('keeps preset pinned defaults when old saved layouts do not include pin state', () => {
    window.localStorage.setItem(
      workspaceStorageKey,
      JSON.stringify([
        {
          id: 'overview',
          kind: 'overview',
          open: true,
        },
      ]),
    );

    const restored = loadStoredWidgetState({
      presets: widgetPresets,
      defaultOpenKinds,
      blueprints: widgetBlueprints,
    });

    expect(restored?.find((widget) => widget.id === 'overview')?.pinned).toBe(true);
  });
});
