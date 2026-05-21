import { beforeEach, describe, expect, it } from 'vitest';

import { widgetBlueprints, widgetPresets } from './workspaceWidgetCatalog';
import { loadStoredWidgetState, saveStoredWidgetState, workspaceStorageKey } from './workspaceStorage';
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
});
