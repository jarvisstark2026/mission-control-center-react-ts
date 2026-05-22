import { clampNumber } from './workspaceStorage';
import type { WorkspaceWidget } from './workspaceTypes';

export type WorkspaceModePresetId = 'admin-ops' | 'home' | 'support' | 'security';

export type WorkspaceModePreset = {
  id: WorkspaceModePresetId;
  label: string;
  note: string;
};

type PresetWidgetLayout = {
  kind: WorkspaceWidget['kind'];
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  pinned?: boolean;
};

export const workspaceModePresets: WorkspaceModePreset[] = [
  { id: 'admin-ops', label: 'Admin ops', note: 'approvals / agent / registry' },
  { id: 'home', label: 'Home mode', note: 'safe actions / schedule' },
  { id: 'support', label: 'Support mode', note: 'diagnostics / registry' },
  { id: 'security', label: 'Security mode', note: 'alerts / routes / topology' },
];

const modeLayouts: Record<WorkspaceModePresetId, PresetWidgetLayout[]> = {
  'admin-ops': [
    { kind: 'command-inbox', x: 24, y: 76, width: 390, height: 430, zIndex: 10, pinned: true },
    { kind: 'agent-console', x: 430, y: 76, width: 390, height: 430, zIndex: 9 },
    { kind: 'integration-registry', x: 836, y: 76, width: 380, height: 430, zIndex: 8 },
    { kind: 'notifications', x: 24, y: 522, width: 430, height: 250, zIndex: 7 },
    { kind: 'agent-control', x: 470, y: 522, width: 360, height: 250, zIndex: 6 },
  ],
  home: [
    { kind: 'command-inbox', x: 24, y: 76, width: 390, height: 360, zIndex: 9, pinned: true },
    { kind: 'home-systems', x: 430, y: 76, width: 430, height: 420, zIndex: 8 },
    { kind: 'notifications', x: 876, y: 76, width: 360, height: 300, zIndex: 7 },
    { kind: 'map', x: 24, y: 452, width: 360, height: 260, zIndex: 6 },
    { kind: 'schedule', x: 400, y: 512, width: 340, height: 240, zIndex: 5 },
  ],
  support: [
    { kind: 'command-inbox', x: 24, y: 76, width: 390, height: 390, zIndex: 10, pinned: true },
    { kind: 'agent-console', x: 430, y: 76, width: 390, height: 420, zIndex: 9 },
    { kind: 'notifications', x: 836, y: 76, width: 360, height: 320, zIndex: 8 },
    { kind: 'graph', x: 24, y: 482, width: 360, height: 240, zIndex: 7 },
    { kind: 'integration-registry', x: 400, y: 512, width: 360, height: 240, zIndex: 6 },
  ],
  security: [
    { kind: 'command-inbox', x: 24, y: 76, width: 390, height: 390, zIndex: 10, pinned: true },
    { kind: 'notifications', x: 430, y: 76, width: 380, height: 340, zIndex: 9 },
    { kind: 'integration-registry', x: 826, y: 76, width: 360, height: 340, zIndex: 8 },
    { kind: 'map', x: 24, y: 482, width: 370, height: 260, zIndex: 7 },
    { kind: 'diagram', x: 410, y: 452, width: 420, height: 300, zIndex: 6 },
  ],
};

export function createWorkspaceModePresetLayout(
  presetId: WorkspaceModePresetId,
  widgets: WorkspaceWidget[],
  bounds: { width: number; height: number },
) {
  const layoutByKind = new Map(modeLayouts[presetId].map((layout) => [layout.kind, layout]));
  const canvasWidth = Math.max(720, bounds.width || 1200);
  const canvasHeight = Math.max(520, bounds.height || 800);

  return widgets.map((widget) => {
    const layout = layoutByKind.get(widget.kind);
    if (!layout) {
      return {
        ...widget,
        open: false,
        hidden: true,
        pinned: false,
      };
    }

    const width = Math.max(widget.minWidth, Math.min(layout.width, canvasWidth - 32));
    const height = Math.max(widget.minHeight, Math.min(layout.height, canvasHeight - 96));

    return {
      ...widget,
      x: clampNumber(layout.x, widget.x, 0, Math.max(0, canvasWidth - width)),
      y: clampNumber(layout.y, widget.y, 0, Math.max(0, canvasHeight - height)),
      width,
      height,
      zIndex: layout.zIndex,
      open: true,
      hidden: false,
      pinned: Boolean(layout.pinned),
    };
  });
}
