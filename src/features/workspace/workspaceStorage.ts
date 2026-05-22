import { readLocalStorageJson, removeLocalStorageItem, writeLocalStorageJson } from './browserStorage';
import { isWorkspaceWidgetKind, type WorkspaceWidget } from './workspaceTypes';

export type WidgetBlueprint = Pick<WorkspaceWidget, 'title' | 'subtitle' | 'surfaceAlpha' | 'lineAlpha' | 'minWidth' | 'minHeight'>;

export const workspaceStorageKey = 'mission-control-center.workspace.layout.v1';
const workspaceLayoutStoragePrefix = `${workspaceStorageKey}.workspace.`;

export function getWorkspaceWidgetStorageKey(workspaceId = 'main') {
  return workspaceId === 'main' ? workspaceStorageKey : `${workspaceLayoutStoragePrefix}${workspaceId}`;
}

export function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizePreviewFileId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isStoredWidgetRecord(value: unknown): value is Partial<WorkspaceWidget> & { id: string } {
  return Boolean(value && typeof value === 'object' && typeof (value as Partial<WorkspaceWidget>).id === 'string');
}

export function loadStoredWidgetState({
  presets,
  defaultOpenKinds,
  blueprints,
  workspaceId = 'main',
}: {
  presets: WorkspaceWidget[];
  defaultOpenKinds: Set<WorkspaceWidget['kind']>;
  blueprints: Record<WorkspaceWidget['kind'], WidgetBlueprint>;
  workspaceId?: string;
}): WorkspaceWidget[] | null {
  const parsed = readLocalStorageJson<Partial<WorkspaceWidget>[]>(getWorkspaceWidgetStorageKey(workspaceId));
  if (!Array.isArray(parsed)) return null;

  try {
    const presetIds = new Set(presets.map((preset) => preset.id));
    const byId = new Map(parsed.filter(isStoredWidgetRecord).map((item) => [item.id, item]));
    const normalizedPresets = presets.map((preset) => {
      const stored = byId.get(preset.id);
      if (!stored) return { ...preset, open: defaultOpenKinds.has(preset.kind) };

      const minWidth = clampNumber(typeof stored.minWidth === 'number' ? stored.minWidth : preset.minWidth, preset.minWidth, 120, 1920);
      const minHeight = clampNumber(typeof stored.minHeight === 'number' ? stored.minHeight : preset.minHeight, preset.minHeight, 120, 1080);
      const effectiveMinWidth = preset.kind === 'file-explorer' ? Math.max(minWidth, 360) : minWidth;
      const effectiveMinHeight = preset.kind === 'file-explorer' ? Math.max(minHeight, 380) : minHeight;
      const isOpen = typeof stored.open === 'boolean' ? stored.open : defaultOpenKinds.has(preset.kind);

      return {
        ...preset,
        open: isOpen,
        minWidth: effectiveMinWidth,
        minHeight: effectiveMinHeight,
        width: clampNumber(stored.width, preset.width, effectiveMinWidth, 4096),
        height: clampNumber(stored.height, preset.height, effectiveMinHeight, 4096),
        x: clampNumber(stored.x, preset.x, -8192, 8192),
        y: clampNumber(stored.y, preset.y, isOpen ? 0 : -8192, 8192),
        zIndex: clampNumber(stored.zIndex, preset.zIndex, 0, 999),
        surfaceAlpha: clampNumber(stored.surfaceAlpha, preset.surfaceAlpha, 0, 1),
        lineAlpha: clampNumber(stored.lineAlpha, preset.lineAlpha, 0, 1),
        pinned: typeof stored.pinned === 'boolean' ? stored.pinned : preset.pinned,
        hidden: typeof stored.hidden === 'boolean' ? stored.hidden : undefined,
        previewFileId: normalizePreviewFileId(stored.previewFileId),
      };
    });

    const dynamicWidgets = parsed
      .filter((item): item is Partial<WorkspaceWidget> & { id: string; kind: WorkspaceWidget['kind'] } =>
        Boolean(isStoredWidgetRecord(item) && !presetIds.has(item.id) && item.kind && isWorkspaceWidgetKind(item.kind)),
      )
      .map((stored) => {
        const kind = stored.kind;
        const blueprint = blueprints[kind];
        const minWidth = clampNumber(typeof stored.minWidth === 'number' ? stored.minWidth : blueprint.minWidth, blueprint.minWidth, 120, 1920);
        const minHeight = clampNumber(typeof stored.minHeight === 'number' ? stored.minHeight : blueprint.minHeight, blueprint.minHeight, 120, 1080);
        const isOpen = typeof stored.open === 'boolean' ? stored.open : true;
        return {
          id: stored.id,
          kind,
          title: blueprint.title,
          subtitle: blueprint.subtitle,
          open: isOpen,
          minWidth,
          minHeight,
          width: clampNumber(stored.width, blueprint.minWidth, minWidth, 4096),
          height: clampNumber(stored.height, blueprint.minHeight, minHeight, 4096),
          x: clampNumber(stored.x, 0, -8192, 8192),
          y: clampNumber(stored.y, 0, isOpen ? 0 : -8192, 8192),
          zIndex: clampNumber(stored.zIndex, 1, 0, 999),
          surfaceAlpha: clampNumber(stored.surfaceAlpha, blueprint.surfaceAlpha, 0, 1),
          lineAlpha: clampNumber(stored.lineAlpha, blueprint.lineAlpha, 0, 1),
          pinned: typeof stored.pinned === 'boolean' ? stored.pinned : undefined,
          hidden: typeof stored.hidden === 'boolean' ? stored.hidden : undefined,
          previewFileId: normalizePreviewFileId(stored.previewFileId),
        };
      });

    return [...normalizedPresets, ...dynamicWidgets];
  } catch {
    return null;
  }
}

export function saveStoredWidgetState(widgets: WorkspaceWidget[], workspaceId = 'main'): boolean {
  const serializableWidgets = widgets.map((widget) => ({
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
    surfaceAlpha: widget.surfaceAlpha,
    lineAlpha: widget.lineAlpha,
    pinned: widget.pinned,
    hidden: widget.hidden,
    previewFileId: widget.previewFileId ?? null,
  }));

  return writeLocalStorageJson(getWorkspaceWidgetStorageKey(workspaceId), serializableWidgets);
}

export function clearStoredWidgetState(workspaceId = 'main'): boolean {
  return removeLocalStorageItem(getWorkspaceWidgetStorageKey(workspaceId));
}

export function clearAllStoredWidgetStates(workspaceIds: Iterable<string> = ['main']): boolean {
  if (typeof window === 'undefined') return false;

  const keys = new Set<string>();
  for (const workspaceId of workspaceIds) {
    keys.add(getWorkspaceWidgetStorageKey(workspaceId));
  }

  keys.add(workspaceStorageKey);
  for (const key of Object.keys(window.localStorage)) {
    if (key === workspaceStorageKey || key.startsWith(workspaceLayoutStoragePrefix)) {
      keys.add(key);
    }
  }

  return Array.from(keys).every((key) => removeLocalStorageItem(key));
}

export function subscribeStoredWidgetState(workspaceId: string, onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const storageKey = getWorkspaceWidgetStorageKey(workspaceId);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onChange();
  };

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
