import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { StatusChip } from '../../components/ui/StatusChip';
import { createId } from '../../lib/createId';
import { WorkspaceButton } from './workspaceBlocks';
import { WorkspaceAtmosphere, WorkspaceCanvas } from './WorkspaceCanvas';
import type { ResizeEdge } from './WorkspaceResizeHandles';
import type { WorkspaceWidget } from './workspaceTypes';
import { calculateCenteredWidgetPosition, calculatePartiallyOffscreenDragPosition } from './workspaceGeometry';
import { createLocalFileRecord, clearPersistedLocalFiles, generalUseFolderLabel, measureImageDimensions, readFolderEntries, readPersistedLocalFiles, writePersistedLocalFiles, type LocalFileRecord, type LocalFolderEntry, type LocalImageDimensions, type ShowDirectoryPickerFn } from './workspaceLocalFiles';
import { clampNumber, clearStoredWidgetState, loadStoredWidgetState, saveStoredWidgetState } from './workspaceStorage';
import { getFocusedWidget, getWidgetLabel, launchableWindowKinds, widgetBlueprints, widgetPresets } from './workspaceWidgetCatalog';
import { defaultMarketGraph, getMarketGraph, type MarketGraph } from './workspaceMarketData';
import { WorkspaceWidgetCard, type WorkspaceWidgetRuntimeProps } from './workspaceWidgets';
import { closeWorkspaceExtensionWindow, closeWorkspacePanelWindow, openWorkspaceExtensionWindow, openWorkspacePanelWindow, returnToWorkspaceHub } from './workspacePanelWindows';
import { isWorkspaceExtensionUrl } from './workspacePanelRouting';
import { VisualLab } from '../visual-lab/VisualLab';
import './workspace.css';

const defaultOpenKinds = new Set<WorkspaceWidget['kind']>([
  'overview',
  'graph',
  'trading-graph',
  'browser',
  'schedule',
  'launcher',
  'file-explorer',
  'sheet',
]);

const initialWidgetState = widgetPresets.map((widget) => ({
  ...widget,
  open: defaultOpenKinds.has(widget.kind),
}));

function createInitialWidgetState() {
  return initialWidgetState.map((widget) => ({ ...widget }));
}

function createBlankWidgetState() {
  return createInitialWidgetState().map((widget) => ({
    ...widget,
    open: false,
    hidden: true,
  }));
}

function createCompactLayout(boundsWidth: number, boundsHeight: number): WorkspaceWidget[] {
  const isNarrow = boundsWidth < 760;
  const stackWidth = isNarrow
    ? Math.max(260, Math.min(boundsWidth - 16, 360))
    : Math.max(260, Math.min(boundsWidth - 16, 420));
  const totalWidgets = widgetPresets.length;
  const openCount = isNarrow ? 1 : boundsHeight < 760 ? 2 : 3;
  const topInset = isNarrow ? 52 : 58;
  const bottomInset = 12;
  const gap = isNarrow ? 6 : 8;
  const closedHeight = isNarrow ? 40 : 44;

  const availableHeight = Math.max(0, boundsHeight - topInset - bottomInset - gap * (totalWidgets - 1));
  const openHeightBudget = Math.max(0, availableHeight - closedHeight * (totalWidgets - openCount));
  const openHeight = Math.max(120, Math.min(isNarrow ? 220 : 160, Math.floor(openHeightBudget / openCount)));

  const openHeights =
    openCount === 1
      ? [Math.max(140, openHeight)]
      : openCount === 2
        ? [openHeight + 10, Math.max(112, openHeight - 6)]
        : [openHeight + 12, Math.max(112, openHeight + 2), Math.max(112, openHeight - 10)];

  let nextY = topInset;

  return widgetPresets.map((widget, index) => {
    const isOpen = index < openCount;
    const height = isOpen ? openHeights[index] ?? openHeight : closedHeight;
    const nextWidget = {
      ...widget,
      x: 8,
      y: nextY,
      width: Math.max(widget.minWidth, stackWidth),
      height,
      zIndex: totalWidgets - index,
      open: isOpen,
    };

    nextY += height + gap;
    return nextWidget;
  });
}

type InteractionState = {
  id: string;
  mode: 'drag' | 'resize';
  edge?: ResizeEdge;
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
};

type WorkspaceProps = {
  panelKind?: WorkspaceWidget['kind'] | null;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: ShowDirectoryPickerFn;
};

function getDirectoryPicker() {
  if (typeof window === 'undefined') return null;
  return (window as DirectoryPickerWindow).showDirectoryPicker ?? null;
}

function getWindowViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

function getEffectiveCanvasSize(canvas: HTMLDivElement | null, bounds: { width: number; height: number }) {
  const rect = canvas?.getBoundingClientRect();
  const viewportSize = getWindowViewportSize();

  return {
    width: Math.max(320, rect?.width ?? 0, bounds.width, viewportSize.width, 1200),
    height: Math.max(240, rect?.height ?? 0, bounds.height, viewportSize.height, 800),
  };
}

export function Workspace({ panelKind = null }: WorkspaceProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isWorkspaceExtension = isWorkspaceExtensionUrl();
  const storedWidgets = useMemo(() => loadStoredWidgetState({ presets: initialWidgetState, defaultOpenKinds, blueprints: widgetBlueprints }), []);
  const initialWidgets = useMemo(
    () => (isWorkspaceExtension ? createBlankWidgetState() : storedWidgets ?? initialWidgetState),
    [isWorkspaceExtension, storedWidgets],
  );
  const widgetsRef = useRef(initialWidgets);
  const interactionRef = useRef<InteractionState | null>(null);
  const compactLayoutAppliedRef = useRef(Boolean(storedWidgets) || isWorkspaceExtension);
  const [widgets, setWidgets] = useState(initialWidgets);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [localFiles, setLocalFiles] = useState<LocalFileRecord[]>([]);
  const [selectedLocalFileId, setSelectedLocalFileId] = useState<string | null>(null);
  const [activeLocalFileId, setActiveLocalFileId] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<LocalFolderEntry[]>([]);
  const [folderPath, setFolderPath] = useState<string | null>(generalUseFolderLabel);
  const persistedLocalFilesLoadedRef = useRef(false);
  const [activeMarketGraphId, setActiveMarketGraphId] = useState(defaultMarketGraph.id);
  const canBrowseFolder = typeof getDirectoryPicker() === 'function';

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    if (panelKind || isWorkspaceExtension || bounds.width < 860) return;
    void saveStoredWidgetState(widgets);
  }, [bounds.width, isWorkspaceExtension, panelKind, widgets]);

  useEffect(() => {
    let cancelled = false;

    void readPersistedLocalFiles().then((records) => {
      if (cancelled) return;
      setLocalFiles(records);
      setSelectedLocalFileId(null);
      setActiveLocalFileId(null);
      persistedLocalFilesLoadedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistedLocalFilesLoadedRef.current) return;
    void writePersistedLocalFiles(localFiles);
  }, [localFiles]);

  useEffect(() => {
    if (activeLocalFileId) return;

    const previewWidget = widgetsRef.current.find((widget) => widget.kind === '3d' && widget.previewFileId);
    if (!previewWidget?.previewFileId) return;

    const restoredFile = localFiles.find((record) => record.id === previewWidget.previewFileId) ?? null;
    if (!restoredFile) return;

    setSelectedLocalFileId(restoredFile.id);
    setActiveLocalFileId(restoredFile.id);
  }, [activeLocalFileId, localFiles]);

  useEffect(() => {
    const updateBounds = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    };

    updateBounds();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateBounds);
    if (canvasRef.current) observer?.observe(canvasRef.current);

    window.addEventListener('resize', updateBounds);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  useEffect(() => {
    if (isWorkspaceExtension || !bounds.width || !bounds.height) return;

    const isCompact = bounds.width < 860;
    if (!isCompact) {
      compactLayoutAppliedRef.current = false;
      return;
    }

    if (compactLayoutAppliedRef.current || interactionRef.current) return;

    compactLayoutAppliedRef.current = true;
    setWidgets(createCompactLayout(bounds.width, bounds.height));
  }, [bounds.height, bounds.width, isWorkspaceExtension]);

  useEffect(() => {
    const stopInteraction = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointerup', stopInteraction);
    window.addEventListener('pointercancel', stopInteraction);
    window.addEventListener('blur', stopInteraction);

    return () => {
      window.removeEventListener('pointerup', stopInteraction);
      window.removeEventListener('pointercancel', stopInteraction);
      window.removeEventListener('blur', stopInteraction);
    };
  }, []);

  const orderedWidgets = useMemo(() => widgets.filter((widget) => !widget.hidden).sort((a, b) => a.zIndex - b.zIndex), [widgets]);

  const openPanelWindow = (kind: WorkspaceWidget['kind']) => {
    openWorkspacePanelWindow(kind);
  };

  const returnToHub = () => {
    returnToWorkspaceHub();
  };

  const closePanelWindow = () => {
    closeWorkspacePanelWindow();
  };

  const resetWorkspaceLayout = () => {
    interactionRef.current = null;
    const resetWidgets = createInitialWidgetState();
    widgetsRef.current = resetWidgets;
    void clearStoredWidgetState();
    setWidgets(resetWidgets);
  };

  const openBlankWorkspaceExtension = () => {
    openWorkspaceExtensionWindow();
  };

  const closeBlankWorkspaceExtension = () => {
    closeWorkspaceExtensionWindow();
  };

  const raiseWidget = (id: string) => {
    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      return current.map((widget) => (widget.id === id ? { ...widget, zIndex: highest + 1 } : widget));
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a, video, [role="button"]')) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    const canvas = canvasRef.current;
    if (!widget || !canvas) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'drag',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: widget.x,
      startTop: widget.y,
      startWidth: widget.width,
      startHeight: widget.height,
    };
  };

  const startResize = (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => {
    if (event.button !== 0) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    if (!widget) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'resize',
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: widget.x,
      startTop: widget.y,
      startWidth: widget.width,
      startHeight: widget.height,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const currentWidget = widgetsRef.current.find((widget) => widget.id === interaction.id);
    if (!currentWidget) return;

    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;

    if (interaction.mode === 'drag') {
      const { left: nextLeft, top: nextTop } = calculatePartiallyOffscreenDragPosition({
        proposedLeft: interaction.startLeft + deltaX,
        proposedTop: interaction.startTop + deltaY,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
        widgetWidth: currentWidget.width,
        widgetHeight: currentWidget.open ? currentWidget.height : 58,
      });

      setWidgets((current) =>
        current.map((widget) =>
          widget.id === interaction.id
            ? {
                ...widget,
                x: nextLeft,
                y: nextTop,
              }
            : widget,
        ),
      );
      return;
    }

    const isClosed = !currentWidget.open;
    const edge = interaction.edge ?? 'corner';
    let nextLeft = interaction.startLeft;
    let nextWidth = interaction.startWidth;
    let nextHeight = interaction.startHeight;

    if (edge === 'left') {
      nextLeft = interaction.startLeft + deltaX;
      nextWidth = interaction.startWidth - deltaX;
    } else if (edge === 'right') {
      nextWidth = interaction.startWidth + deltaX;
    } else if (edge === 'bottom') {
      nextHeight = interaction.startHeight + deltaY;
    } else {
      nextWidth = interaction.startWidth + deltaX;
      nextHeight = interaction.startHeight + deltaY;
    }

    if (isClosed) {
      nextHeight = interaction.startHeight;
      if (edge !== 'left') nextLeft = interaction.startLeft;
    }

    nextWidth = Math.max(currentWidget.minWidth, nextWidth);
    nextHeight = Math.max(currentWidget.minHeight, nextHeight);

    if (edge === 'left' && nextWidth === currentWidget.minWidth) {
      nextLeft = interaction.startLeft + (interaction.startWidth - currentWidget.minWidth);
    }

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === interaction.id
          ? {
              ...widget,
              x: edge === 'left' ? nextLeft : widget.x,
              y: widget.y,
              width: nextWidth,
              height: nextHeight,
            }
          : widget,
      ),
    );
  };

  const stopInteraction = () => {
    interactionRef.current = null;
  };

  const toggleWidget = (id: string) => {
    raiseWidget(id);
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id ? { ...widget, hidden: false, open: !widget.open, zIndex: widget.zIndex + 1 } : widget,
      ),
    );
  };

  const recenterWidget = (id: string) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const canvasWidth = Math.max(320, canvasRect?.width ?? bounds.width ?? 0);
    const canvasHeight = Math.max(240, canvasRect?.height ?? bounds.height ?? 0);

    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const next = current.map((widget) => {
        if (widget.id !== id) return widget;

        const { left, top } = calculateCenteredWidgetPosition({
          canvasWidth,
          canvasHeight,
          widgetWidth: widget.width,
          widgetHeight: widget.open ? widget.height : 58,
        });

        return {
          ...widget,
          x: left,
          y: top,
          zIndex: highest + 1,
        };
      });
      widgetsRef.current = next;
      return next;
    });
  };

  const closeWidget = (id: string) => {
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              open: false,
              hidden: true,
              zIndex: widget.zIndex + 1,
            }
          : widget,
      ),
    );
  };

  const focusWidget = (id: string, open = true) => {
    raiseWidget(id);
    if (!open) return;

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              open: true,
              hidden: false,
              zIndex: widget.zIndex + 1,
            }
          : widget,
      ),
    );
  };

  const openWidgetInCenter = (id: string) => {
    const canvasSize = getEffectiveCanvasSize(canvasRef.current, bounds);

    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const next = current.map((widget) => {
        if (widget.id !== id) return widget;

        const { left, top } = calculateCenteredWidgetPosition({
          canvasWidth: canvasSize.width,
          canvasHeight: canvasSize.height,
          widgetWidth: widget.width,
          widgetHeight: widget.height,
        });

        return {
          ...widget,
          x: left,
          y: top,
          open: true,
          hidden: false,
          zIndex: highest + 1,
        };
      });

      widgetsRef.current = next;
      return next;
    });
  };

  const openWorkspaceWidget = (kind: WorkspaceWidget['kind']) => {
    const target = widgetsRef.current.find((widget) => widget.kind === kind);
    if (target) {
      openWidgetInCenter(target.id);
      return;
    }

    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const nextWidget = getFocusedWidget(kind, bounds.width || 1200, bounds.height || 800);
      const next = [...current, { ...nextWidget, zIndex: highest + 1 }];
      widgetsRef.current = next;
      return next;
    });
  };

  const openMarketGraph = (graph: MarketGraph) => {
    setActiveMarketGraphId(graph.id);
    openWorkspaceWidget('trading-graph');
  };

  const browseFolder = async () => {
    const picker = getDirectoryPicker();
    if (!picker) return;

    try {
      const handle = await picker({ mode: 'read', startIn: 'documents' });
      setFolderPath(handle.name ?? generalUseFolderLabel);
      const entries = await readFolderEntries(handle);
      setFolderEntries(entries);
      const files = entries.flatMap((entry) => (entry.file ? [entry.file] : []));
      if (files.length) {
        await importLocalFiles(files);
      }
      focusWidget('file-explorer');
    } catch {
      // Native picker cancellation is expected and does not need user-facing state.
    }
  };

  const openPreviewWidget = (file: LocalFileRecord, dimensions: LocalImageDimensions | null = null) => {
    const blueprint = widgetBlueprints['3d'];
    const viewportSize = getWindowViewportSize();
    const viewportWidth = Math.max(320, bounds.width || viewportSize.width || blueprint.minWidth);
    const viewportHeight = Math.max(240, bounds.height || viewportSize.height || blueprint.minHeight);
    const chromeWidth = 36;
    const chromeHeight = 108;
    const highest = widgetsRef.current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
    const existing = widgetsRef.current.find((widget) => widget.kind === '3d' && widget.previewFileId === file.id);

    if (existing) {
      setWidgets((current) => {
        const next = current.map((widget) =>
          widget.id === existing.id
            ? {
                ...widget,
                open: true,
                hidden: false,
                subtitle: file.path,
                zIndex: highest + 1,
              }
            : widget,
        );
        widgetsRef.current = next;
        return next;
      });
      return;
    }

    const scale = dimensions ? Math.min((viewportWidth * 0.88) / dimensions.width, (viewportHeight * 0.86) / dimensions.height, 1) : 1;
    const nextWidth = dimensions ? Math.max(blueprint.minWidth, Math.round(dimensions.width * scale) + chromeWidth) : blueprint.minWidth;
    const nextHeight = dimensions ? Math.max(blueprint.minHeight, Math.round(dimensions.height * scale) + chromeHeight) : blueprint.minHeight;
    const offset = Math.min(72, widgetsRef.current.filter((widget) => widget.kind === '3d').length * 18);

    setWidgets((current) => {
      const highestZ = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const nextWidget: WorkspaceWidget = {
        id: createId(`preview-${file.id}`),
        kind: '3d',
        title: 'Preview',
        subtitle: file.path,
        x: clampNumber(528 + offset, 528, 0, Math.max(0, viewportWidth - nextWidth)),
        y: clampNumber(66 + offset, 66, 0, Math.max(0, viewportHeight - nextHeight)),
        width: nextWidth,
        height: nextHeight,
        zIndex: highestZ + 1,
        surfaceAlpha: blueprint.surfaceAlpha,
        lineAlpha: blueprint.lineAlpha,
        open: true,
        hidden: false,
        minWidth: blueprint.minWidth,
        minHeight: blueprint.minHeight,
        previewFileId: file.id,
      };
      const next = [...current, nextWidget];
      widgetsRef.current = next;
      return next;
    });
  };

  const importLocalFiles = async (selected: FileList | File[]) => {
    const imported = Array.from(selected, createLocalFileRecord);
    if (!imported.length) return [] as LocalFileRecord[];

    const enriched = await Promise.all(
      imported.map(async (record) => ({
        ...record,
        imageDimensions: record.previewKind === 'image' ? await measureImageDimensions(record.file) : null,
      })),
    );

    setLocalFiles((current) => {
      const byId = new Map(current.map((record) => [record.id, record]));
      enriched.forEach((record) => {
        byId.set(record.id, record);
      });
      return Array.from(byId.values()).sort((left, right) => left.path.localeCompare(right.path));
    });

    const first = enriched[0];
    setSelectedLocalFileId(first.id);
    return enriched;
  };

  const openLocalPreview = async (file: LocalFileRecord) => {
    setSelectedLocalFileId(file.id);
    setActiveLocalFileId(file.id);
    const dimensions = file.previewKind === 'image' ? file.imageDimensions ?? (await measureImageDimensions(file.file)) : null;
    openPreviewWidget(file, dimensions);
  };

  const clearLocalFiles = () => {
    setLocalFiles([]);
    setSelectedLocalFileId(null);
    setActiveLocalFileId(null);
    setFolderEntries([]);
    setFolderPath(generalUseFolderLabel);
    setWidgets((current) => {
      const next = current.map((widget) => (widget.kind === '3d' ? { ...widget, previewFileId: null } : widget));
      widgetsRef.current = next;
      return next;
    });
    void clearPersistedLocalFiles();
  };

  const activeMarketGraph = useMemo(() => getMarketGraph(activeMarketGraphId), [activeMarketGraphId]);
  const widgetRuntimeProps: WorkspaceWidgetRuntimeProps = {
    onStartDrag: startDrag,
    onStartResize: startResize,
    onToggleOpen: toggleWidget,
    onRecenter: recenterWidget,
    onClose: closeWidget,
    localFiles,
    activeLocalFileId,
    selectedLocalFileId,
    folderEntries,
    folderPath,
    canBrowseFolder,
    activeMarketGraph,
    onBrowseFiles: importLocalFiles,
    onBrowseFolder: browseFolder,
    onOpenPreview: openLocalPreview,
    onSelectFile: setSelectedLocalFileId,
    onClearFiles: clearLocalFiles,
    onLaunchWorkspaceWidget: openWorkspaceWidget,
    onSelectMarketGraph: openMarketGraph,
    workspaceWidgets: widgets,
    onFocusWidget: focusWidget,
    onCloseWidget: closeWidget,
  };

  if (panelKind) {
    const focusedWidget = getFocusedWidget(panelKind, bounds.width || 1200, bounds.height || 800);

    return (
      <section className="workspace-shell workspace-shell-panel">
        <WorkspaceAtmosphere />

        <div className="workspace-head workspace-head-panel">
          <div className="workspace-brand">Mission Control Center</div>
          <StatusChip tone="ice">connected screen · drag the OS window to another display</StatusChip>
          <div className="workspace-launcher">
            <button type="button" className="workspace-launch-button" onClick={returnToHub}>
              Open hub
            </button>
            <button
              type="button"
              className="widget-close workspace-launch-button-close"
              onClick={closePanelWindow}
              aria-label="Close page"
              title="Close page"
            >
              ×
            </button>
          </div>
        </div>

        <div className="workspace-panel-stage">
          <WorkspaceWidgetCard
            widget={focusedWidget}
            showChrome={panelKind === 'browser'}
            {...widgetRuntimeProps}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-shell">
      <WorkspaceAtmosphere />

      <VisualLab />

      <div className="workspace-head">
        <div className="workspace-brand">Mission Control Center</div>
        <StatusChip tone="cool">tailnet live · drag · resize · stack</StatusChip>
        <div className="workspace-launcher">
          <WorkspaceButton variant="secondary" className="workspace-launch-button is-muted" onClick={resetWorkspaceLayout}>
            Reset layout
          </WorkspaceButton>
          {isWorkspaceExtension ? (
            <WorkspaceButton
              className="workspace-launch-button workspace-new-screen-button workspace-extension-close-button"
              aria-label="Close workspace extension"
              title="Close workspace extension"
              onClick={closeBlankWorkspaceExtension}
            >
              <span className="workspace-extension-close-icon" aria-hidden="true" />
            </WorkspaceButton>
          ) : (
            <WorkspaceButton
              className="workspace-launch-button workspace-new-screen-button"
              aria-label="Create blank workspace"
              title="Create blank workspace"
              onClick={openBlankWorkspaceExtension}
            >
              <span className="workspace-new-screen-icon" aria-hidden="true">
                <span className="workspace-new-screen-frame" />
                <span className="workspace-new-screen-plus" />
              </span>
            </WorkspaceButton>
          )}
          <div className="workspace-launch-pills" role="group" aria-label="Window launch shortcuts">
            {launchableWindowKinds.map((kind) => (
              <WorkspaceButton
                key={kind}
                variant="compact"
                className="workspace-launch-pill"
                onClick={() => openPanelWindow(kind)}
              >
                {getWidgetLabel(kind)}
              </WorkspaceButton>
            ))}
          </div>
        </div>
      </div>

      <WorkspaceCanvas
        canvasRef={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={stopInteraction}
        onPointerCancel={stopInteraction}
      >
        {orderedWidgets.map((widget) => (
          <WorkspaceWidgetCard
            key={widget.id}
            widget={widget}
            {...widgetRuntimeProps}
          />
        ))}
      </WorkspaceCanvas>
    </section>
  );
}
