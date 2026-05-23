import { beforeEach, describe, expect, it } from 'vitest';

import {
  addWorkspaceCustomPreset,
  createWorkspaceCustomPreset,
  createWorkspaceCustomPresetLayout,
  loadWorkspaceCustomPresets,
  removeWorkspaceCustomPreset,
  updateWorkspaceCustomPresetLabel,
} from './workspaceCustomPresets';
import { widgetPresets } from './workspaceWidgetCatalog';

describe('workspace custom presets', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves a named reusable layout snapshot', () => {
    const preset = createWorkspaceCustomPreset({
      label: '  Review   wall  ',
      sourceWorkspaceId: 'main',
      widgets: widgetPresets.slice(0, 2),
    });

    const next = addWorkspaceCustomPreset(preset);

    expect(next[0].label).toBe('Review wall');
    expect(loadWorkspaceCustomPresets()[0].label).toBe('Review wall');
  });

  it('restores widget positions from a custom preset', () => {
    const sourceWidgets = widgetPresets.slice(0, 2).map((widget, index) => ({
      ...widget,
      x: 120 + index * 80,
      y: 90 + index * 40,
      open: true,
    }));
    const preset = createWorkspaceCustomPreset({
      label: 'Pinned pair',
      sourceWorkspaceId: 'workspace-right',
      widgets: sourceWidgets,
    });
    const currentWidgets = widgetPresets.slice(0, 2).map((widget) => ({ ...widget, x: 0, y: 0, open: false }));

    const restored = createWorkspaceCustomPresetLayout(preset, currentWidgets, { width: 1200, height: 800 });

    expect(restored[0]).toMatchObject({ x: 120, y: 90, open: true });
    expect(restored[1]).toMatchObject({ x: 200, y: 130, open: true });
  });

  it('removes a saved custom preset', () => {
    const preset = createWorkspaceCustomPreset({
      label: 'Temporary wall',
      sourceWorkspaceId: 'main',
      widgets: widgetPresets.slice(0, 2),
    });

    addWorkspaceCustomPreset(preset);

    expect(loadWorkspaceCustomPresets()).toHaveLength(1);
    expect(removeWorkspaceCustomPreset(preset.id)).toHaveLength(0);
    expect(loadWorkspaceCustomPresets()).toHaveLength(0);
  });

  it('renames a saved custom preset', () => {
    const preset = createWorkspaceCustomPreset({
      label: 'Old wall',
      sourceWorkspaceId: 'main',
      widgets: widgetPresets.slice(0, 2),
    });

    addWorkspaceCustomPreset(preset);

    expect(updateWorkspaceCustomPresetLabel(preset.id, '  New   wall  ')[0].label).toBe('New wall');
    expect(loadWorkspaceCustomPresets()[0].label).toBe('New wall');
  });
});
