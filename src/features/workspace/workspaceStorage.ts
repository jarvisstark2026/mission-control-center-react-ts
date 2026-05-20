import { isWorkspaceWidgetKind, type WorkspaceWidget } from './workspaceTypes';

export type WidgetBlueprint = Pick<WorkspaceWidget, 'title' | 'subtitle' | 'surfaceAlpha' | 'lineAlpha' | 'minWidth' | 'minHeight'>;

export const workspaceStorageKey = 'mission-control-center.workspace.layout.v1';

export function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function loadStoredWidgetState({
  presets,
  defaultOpenKinds,
  blueprints,
}: {
  presets: WorkspaceWidget[];
  defaultOpenKinds: Set<WorkspaceWidget['kind']>;
  blueprints: Record<WorkspaceWidget['kind'], WidgetBlueprint>;
}): WorkspaceWidget[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkspaceWidget>[];
    if (!Array.isArray(parsed)) return null;

    const byId = new Map(parsed.filter((item): item is Partial<WorkspaceWidget> & { id: string } => Boolean(item && item.id)).map((item) => [item.id, item]));
    const normalizedPresets = presets.map((preset) => {
      const stored = byId.get(preset.id);
      if (!stored) return { ...preset, open: defaultOpenKinds.has(preset.kind) };

      const minWidth = clampNumber(typeof stored.minWidth === 'number' ? stored.minWidth : preset.minWidth, preset.minWidth, 120, 1920);
      const minHeight = clampNumber(typeof stored.minHeight === 'number' ? stored.minHeight : preset.minHeight, preset.minHeight, 120, 1080);
      const effectiveMinWidth = preset.kind === 'file-explorer' ? Math.max(minWidth, 360) : minWidth;
      const effectiveMinHeight = preset.kind === 'file-explorer' ? Math.max(minHeight, 380) : minHeight;

      return {
        ...preset,
        open: typeof stored.open === 'boolean' ? stored.open : defaultOpenKinds.has(preset.kind),
        minWidth: effectiveMinWidth,
        minHeight: effectiveMinHeight,
        width: clampNumber(stored.width, preset.width, effectiveMinWidth, 4096),
        height: clampNumber(stored.height, preset.height, effectiveMinHeight, 4096),
        x: clampNumber(stored.x, preset.x, -8192, 8192),
        y: clampNumber(stored.y, preset.y, -8192, 8192),
        zIndex: clampNumber(stored.zIndex, preset.zIndex, 0, 999),
        surfaceAlpha: clampNumber(stored.surfaceAlpha, preset.surfaceAlpha, 0, 1),
        lineAlpha: clampNumber(stored.lineAlpha, preset.lineAlpha, 0, 1),
      };
    });

    const dynamicWidgets = parsed
      .filter((item): item is Partial<WorkspaceWidget> & { id: string } => Boolean(item && item.id && !presets.some((preset) => preset.id === item.id) && item.kind && isWorkspaceWidgetKind(item.kind)))
      .map((stored) => {
        const kind = stored.kind as WorkspaceWidget['kind'];
        const blueprint = blueprints[kind];
        const minWidth = clampNumber(typeof stored.minWidth === 'number' ? stored.minWidth : blueprint?.minWidth ?? 300, blueprint?.minWidth ?? 300, 120, 1920);
        const minHeight = clampNumber(typeof stored.minHeight === 'number' ? stored.minHeight : blueprint?.minHeight ?? 180, blueprint?.minHeight ?? 180, 120, 1080);
        return {
          ...stored,
          kind,
          title: blueprint?.title ?? stored.title ?? kind,
          subtitle: blueprint?.subtitle ?? stored.subtitle ?? '',
          open: typeof stored.open === 'boolean' ? stored.open : true,
          minWidth,
          minHeight,
          width: clampNumber(stored.width, blueprint?.minWidth ?? minWidth, minWidth, 4096),
          height: clampNumber(stored.height, blueprint?.minHeight ?? minHeight, minHeight, 4096),
          x: clampNumber(stored.x, 0, -8192, 8192),
          y: clampNumber(stored.y, 0, -8192, 8192),
          zIndex: clampNumber(stored.zIndex, 1, 0, 999),
          surfaceAlpha: clampNumber(stored.surfaceAlpha, blueprint?.surfaceAlpha ?? 0.08, 0, 1),
          lineAlpha: clampNumber(stored.lineAlpha, blueprint?.lineAlpha ?? 0.14, 0, 1),
        } as WorkspaceWidget;
      });

    return [...normalizedPresets, ...dynamicWidgets];
  } catch {
    return null;
  }
}

export function saveStoredWidgetState(widgets: WorkspaceWidget[]): boolean {
  if (typeof window === 'undefined') return false;

  try {
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
      previewFileId: widget.previewFileId ?? null,
    }));

    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(serializableWidgets));
    return true;
  } catch {
    return false;
  }
}
