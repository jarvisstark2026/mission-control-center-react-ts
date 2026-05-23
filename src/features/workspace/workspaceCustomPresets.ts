import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';
import { clampNumber } from './workspaceStorage';
import { isWorkspaceWidgetKind, type WorkspaceWidget } from './workspaceTypes';
import { widgetBlueprints } from './workspaceWidgetCatalog';

export type WorkspaceCustomPresetWidget = Pick<
  WorkspaceWidget,
  'id' | 'kind' | 'x' | 'y' | 'width' | 'height' | 'zIndex' | 'open' | 'minWidth' | 'minHeight'
> &
  Partial<Pick<WorkspaceWidget, 'pinned' | 'hidden' | 'previewFileId'>>;

export type WorkspaceCustomPreset = {
  id: string;
  label: string;
  note: string;
  sourceWorkspaceId: string;
  createdAt: string;
  widgets: WorkspaceCustomPresetWidget[];
};

const workspaceCustomPresetsStorageKey = 'mission-control-center.workspace.custom-presets.v1';
const maxWorkspaceCustomPresets = 12;

function normalizePresetLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').slice(0, 42);
}

function isPresetWidget(value: unknown): value is WorkspaceCustomPresetWidget {
  const widget = value as Partial<WorkspaceCustomPresetWidget>;
  return Boolean(
    widget &&
      typeof widget === 'object' &&
      typeof widget.id === 'string' &&
      typeof widget.kind === 'string' &&
      isWorkspaceWidgetKind(widget.kind),
  );
}

function normalizePreset(value: unknown): WorkspaceCustomPreset | null {
  const preset = value as Partial<WorkspaceCustomPreset>;
  const label = typeof preset?.label === 'string' ? normalizePresetLabel(preset.label) : '';
  const widgets = Array.isArray(preset?.widgets) ? preset.widgets.filter(isPresetWidget) : [];

  if (!preset || typeof preset !== 'object' || !label || !widgets.length) return null;

  return {
    id: typeof preset.id === 'string' && preset.id ? preset.id : `preset-${Date.now()}`,
    label,
    note: typeof preset.note === 'string' ? preset.note.slice(0, 72) : 'saved workspace layout',
    sourceWorkspaceId: typeof preset.sourceWorkspaceId === 'string' ? preset.sourceWorkspaceId : 'main',
    createdAt: typeof preset.createdAt === 'string' ? preset.createdAt : new Date().toISOString(),
    widgets,
  };
}

export function loadWorkspaceCustomPresets(): WorkspaceCustomPreset[] {
  const parsed = readLocalStorageJson<unknown[]>(workspaceCustomPresetsStorageKey);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(normalizePreset)
    .filter((preset): preset is WorkspaceCustomPreset => Boolean(preset))
    .slice(0, maxWorkspaceCustomPresets);
}

export function saveWorkspaceCustomPresets(presets: WorkspaceCustomPreset[]) {
  return writeLocalStorageJson(workspaceCustomPresetsStorageKey, presets.slice(0, maxWorkspaceCustomPresets));
}

export function createWorkspaceCustomPreset({
  label,
  sourceWorkspaceId,
  widgets,
}: {
  label: string;
  sourceWorkspaceId: string;
  widgets: WorkspaceWidget[];
}): WorkspaceCustomPreset {
  const createdAt = new Date().toISOString();
  const normalizedLabel = normalizePresetLabel(label) || `Layout ${createdAt.slice(11, 16)}`;

  return {
    id: `custom-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    label: normalizedLabel,
    note: sourceWorkspaceId === 'main' ? 'saved from main workspace' : `saved from ${sourceWorkspaceId}`,
    sourceWorkspaceId,
    createdAt,
    widgets: widgets.map((widget) => ({
      id: widget.id,
      kind: widget.kind,
      x: widget.x,
      y: widget.y,
      width: widget.width,
      height: widget.height,
      zIndex: widget.zIndex,
      open: widget.open,
      minWidth: widget.minWidth,
      minHeight: widget.minHeight,
      pinned: widget.pinned,
      hidden: widget.hidden,
      previewFileId: widget.previewFileId ?? null,
    })),
  };
}

export function addWorkspaceCustomPreset(preset: WorkspaceCustomPreset, current = loadWorkspaceCustomPresets()) {
  const next = [preset, ...current.filter((item) => item.id !== preset.id)].slice(0, maxWorkspaceCustomPresets);
  saveWorkspaceCustomPresets(next);
  return next;
}

export function createWorkspaceCustomPresetLayout(
  preset: WorkspaceCustomPreset,
  currentWidgets: WorkspaceWidget[],
  bounds: { width: number; height: number },
) {
  const canvasWidth = Math.max(720, bounds.width || 1200);
  const canvasHeight = Math.max(520, bounds.height || 800);
  const presetById = new Map(preset.widgets.map((widget) => [widget.id, widget]));
  const currentIds = new Set(currentWidgets.map((widget) => widget.id));

  const restoredBaseWidgets = currentWidgets.map((widget) => {
    const stored = presetById.get(widget.id);
    if (!stored) {
      return { ...widget, open: false, hidden: true, pinned: false };
    }

    const minWidth = clampNumber(stored.minWidth, widget.minWidth, 120, 1920);
    const minHeight = clampNumber(stored.minHeight, widget.minHeight, 120, 1080);
    const width = clampNumber(stored.width, widget.width, minWidth, 4096);
    const height = clampNumber(stored.height, widget.height, minHeight, 4096);

    return {
      ...widget,
      x: clampNumber(stored.x, widget.x, 0, Math.max(0, canvasWidth - width)),
      y: clampNumber(stored.y, widget.y, 0, Math.max(0, canvasHeight - height)),
      width,
      height,
      zIndex: clampNumber(stored.zIndex, widget.zIndex, 0, 999),
      open: typeof stored.open === 'boolean' ? stored.open : true,
      hidden: typeof stored.hidden === 'boolean' ? stored.hidden : false,
      pinned: typeof stored.pinned === 'boolean' ? stored.pinned : widget.pinned,
      previewFileId: typeof stored.previewFileId === 'string' ? stored.previewFileId : null,
    };
  });

  const restoredDynamicWidgets = preset.widgets
    .filter((stored) => !currentIds.has(stored.id) && isWorkspaceWidgetKind(stored.kind))
    .map((stored) => {
      const blueprint = widgetBlueprints[stored.kind];
      const minWidth = clampNumber(stored.minWidth, blueprint.minWidth, 120, 1920);
      const minHeight = clampNumber(stored.minHeight, blueprint.minHeight, 120, 1080);
      const width = clampNumber(stored.width, blueprint.minWidth, minWidth, 4096);
      const height = clampNumber(stored.height, blueprint.minHeight, minHeight, 4096);

      return {
        id: stored.id,
        kind: stored.kind,
        title: blueprint.title,
        subtitle: blueprint.subtitle,
        x: clampNumber(stored.x, 0, 0, Math.max(0, canvasWidth - width)),
        y: clampNumber(stored.y, 0, 0, Math.max(0, canvasHeight - height)),
        width,
        height,
        zIndex: clampNumber(stored.zIndex, 1, 0, 999),
        surfaceAlpha: blueprint.surfaceAlpha,
        lineAlpha: blueprint.lineAlpha,
        open: typeof stored.open === 'boolean' ? stored.open : true,
        minWidth,
        minHeight,
        pinned: stored.pinned,
        hidden: stored.hidden,
        previewFileId: typeof stored.previewFileId === 'string' ? stored.previewFileId : null,
      };
    });

  return [...restoredBaseWidgets, ...restoredDynamicWidgets];
}
