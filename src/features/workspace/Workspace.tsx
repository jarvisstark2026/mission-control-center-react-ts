import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

import { StatusChip } from '../../components/ui/StatusChip';
import { createId } from '../../lib/createId';
import { WorkspaceButton } from './workspaceBlocks';
import { WorkspaceAtmosphere, WorkspaceCanvas } from './WorkspaceCanvas';
import { WorkspaceCloseScreenButton, WorkspaceNewScreenButton } from './WorkspaceScreenButton';
import { WorkspaceWindowTracker } from './WorkspaceWindowTracker';
import type { ResizeEdge } from './WorkspaceResizeHandles';
import type { WorkspaceWidget } from './workspaceTypes';
import { calculateCenteredWidgetPosition, calculatePartiallyOffscreenDragPosition } from './workspaceGeometry';
import { createLocalFileRecord, clearPersistedLocalFiles, generalUseFolderLabel, measureImageDimensions, readFolderEntries, readPersistedLocalFiles, writePersistedLocalFiles, type LocalFileRecord, type LocalFolderEntry, type LocalImageDimensions, type ShowDirectoryPickerFn } from './workspaceLocalFiles';
import { clampNumber, clearAllStoredWidgetStates, getWorkspaceWidgetStorageKey, loadStoredWidgetState, saveStoredWidgetState, subscribeStoredWidgetState } from './workspaceStorage';
import { getFocusedWidget, getWidgetLabel, widgetBlueprints, widgetPresets, workspaceShortcutKinds } from './workspaceWidgetCatalog';
import { defaultMarketGraph, getMarketGraph, type MarketGraph } from './workspaceMarketData';
import { WorkspaceWidgetCard, type WorkspaceWidgetRuntimeProps } from './workspaceWidgets';
import { closeWorkspaceExtensionWindow, closeWorkspacePanelWindow, openWorkspaceExtensionWindow, returnToWorkspaceHub } from './workspacePanelWindows';
import { isWorkspaceExtensionUrl } from './workspacePanelRouting';
import { getAdjacentWorkspaceInstance, getWorkspaceInstanceId, getWorkspaceInstances, subscribeWorkspaceInstances, type WorkspaceTransferDirection } from './workspaceInstances';
import { playWidgetAddedSound } from './workspaceSound';
import { publishWidgetTransfer, subscribeWidgetTransfer, type WorkspaceWidgetTransferAnimation } from './workspaceWidgetTransfer';
import { VisualLab } from '../visual-lab/VisualLab';
import './workspace.css';

const workspaceTransferOutDurationMs = 180;
const workspaceTransferAnimationDurationMs = 240;

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

function loadWidgetStateForWorkspace(workspaceId: string) {
  const storedWidgets = loadStoredWidgetState({
    presets: initialWidgetState,
    defaultOpenKinds,
    blueprints: widgetBlueprints,
    workspaceId,
  });

  return storedWidgets ?? (workspaceId === 'main' ? createInitialWidgetState() : createBlankWidgetState());
}

function parseManagedWidgetId(scopedWidgetId: string, fallbackWorkspaceId: string) {
  const separatorIndex = scopedWidgetId.indexOf('::');
  if (separatorIndex < 0) {
    return {
      workspaceId: fallbackWorkspaceId,
      widgetId: scopedWidgetId,
    };
  }

  return {
    workspaceId: scopedWidgetId.slice(0, separatorIndex) || fallbackWorkspaceId,
    widgetId: scopedWidgetId.slice(separatorIndex + 2),
  };
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
  workspaceId: string;
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
  topBarSlot?: ReactNode;
  footerSlot?: ReactNode;
};

type ActiveWidgetTransferAnimation = WorkspaceWidgetTransferAnimation & {
  widgetId: string;
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
  const width = rect?.width || bounds.width || viewportSize.width || 1200;
  const height = rect?.height || bounds.height || viewportSize.height || 800;

  return {
    width: Math.max(320, width),
    height: Math.max(240, height),
  };
}

function getWorkspacePlaneSize(bounds: { width: number; height: number }) {
  return {
    minWidth: Math.max(320, bounds.width),
    minHeight: Math.max(240, bounds.height),
  };
}

function getWidgetRenderHeight(widget: WorkspaceWidget) {
  return widget.open ? widget.height : 58;
}

function getTransferLandingPosition({
  direction,
  widget,
  canvasWidth,
  canvasHeight,
}: {
  direction: WorkspaceTransferDirection;
  widget: WorkspaceWidget;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const margin = 24;
  const widgetHeight = getWidgetRenderHeight(widget);

  if (direction === 'right') {
    return {
      x: margin,
      y: clampNumber(widget.y, margin, margin, Math.max(margin, canvasHeight - widgetHeight - margin)),
    };
  }

  if (direction === 'left') {
    return {
      x: Math.max(margin, canvasWidth - widget.width - margin),
      y: clampNumber(widget.y, margin, margin, Math.max(margin, canvasHeight - widgetHeight - margin)),
    };
  }

  if (direction === 'down') {
    return {
      x: clampNumber(widget.x, margin, margin, Math.max(margin, canvasWidth - widget.width - margin)),
      y: margin,
    };
  }

  return {
    x: clampNumber(widget.x, margin, margin, Math.max(margin, canvasWidth - widget.width - margin)),
    y: Math.max(margin, canvasHeight - widgetHeight - margin),
  };
}

function getWorkspaceTransferDirection({
  canvasRect,
  deltaX,
  deltaY,
  pointerX,
  pointerY,
  proposedLeft,
  proposedTop,
  visibleLeft,
  visibleTop,
  widget,
}: {
  canvasRect: DOMRect;
  deltaX: number;
  deltaY: number;
  pointerX: number;
  pointerY: number;
  proposedLeft: number;
  proposedTop: number;
  visibleLeft: number;
  visibleTop: number;
  widget: WorkspaceWidget;
}): WorkspaceTransferDirection | null {
  const edgeInset = 2;
  const overflowTrigger = 18;
  const widgetHeight = getWidgetRenderHeight(widget);
  const candidates = [
    {
      direction: 'right' as const,
      active:
        deltaX > 0 &&
        pointerX >= canvasRect.right - edgeInset &&
        proposedLeft + widget.width > visibleLeft + canvasRect.width - overflowTrigger,
      distance: Math.abs(deltaX),
    },
    {
      direction: 'left' as const,
      active: deltaX < 0 && pointerX <= canvasRect.left + edgeInset && proposedLeft < visibleLeft + overflowTrigger,
      distance: Math.abs(deltaX),
    },
    {
      direction: 'down' as const,
      active:
        deltaY > 0 &&
        pointerY >= canvasRect.bottom - edgeInset &&
        proposedTop + widgetHeight > visibleTop + canvasRect.height - overflowTrigger,
      distance: Math.abs(deltaY),
    },
    {
      direction: 'up' as const,
      active: deltaY < 0 && pointerY <= canvasRect.top + edgeInset && proposedTop < visibleTop + overflowTrigger,
      distance: Math.abs(deltaY),
    },
  ];

  return candidates.filter((candidate) => candidate.active).sort((left, right) => right.distance - left.distance)[0]?.direction ?? null;
}

export function Workspace({ panelKind = null, topBarSlot = null, footerSlot = null }: WorkspaceProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);
  const isWorkspaceExtension = isWorkspaceExtensionUrl();
  const workspaceInstanceId = getWorkspaceInstanceId();
  const currentWorkspaceId = isWorkspaceExtension ? workspaceInstanceId ?? 'workspace-extension' : 'main';
  const initialWidgets = useMemo(
    () => (isWorkspaceExtension && !workspaceInstanceId ? createBlankWidgetState() : loadWidgetStateForWorkspace(currentWorkspaceId)),
    [currentWorkspaceId, isWorkspaceExtension, workspaceInstanceId],
  );
  const hasStoredWidgets = typeof window !== 'undefined' && window.localStorage.getItem(getWorkspaceWidgetStorageKey(currentWorkspaceId)) !== null;
  const widgetsRef = useRef(initialWidgets);
  const interactionRef = useRef<InteractionState | null>(null);
  const transferAnimationTimeoutRef = useRef<number | null>(null);
  const transferCommitTimeoutsRef = useRef<Array<{ id: number; widgetId: string }>>([]);
  const compactLayoutAppliedRef = useRef(hasStoredWidgets || isWorkspaceExtension);
  const [widgets, setWidgets] = useState(initialWidgets);
  const [widgetTransferAnimation, setWidgetTransferAnimation] = useState<ActiveWidgetTransferAnimation | null>(null);
  const pendingWidgetSaveRef = useRef<number | null>(null);
  const skipNextWidgetSaveRef = useRef(false);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [localFiles, setLocalFiles] = useState<LocalFileRecord[]>([]);
  const [selectedLocalFileId, setSelectedLocalFileId] = useState<string | null>(null);
  const [activeLocalFileId, setActiveLocalFileId] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<LocalFolderEntry[]>([]);
  const [folderPath, setFolderPath] = useState<string | null>(generalUseFolderLabel);
  const persistedLocalFilesLoadedRef = useRef(false);
  const [activeMarketGraphId, setActiveMarketGraphId] = useState(defaultMarketGraph.id);
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
  const [, setWorkspaceCatalogVersion] = useState(0);
  const bumpWorkspaceCatalogVersion = useCallback(() => setWorkspaceCatalogVersion((version) => version + 1), []);
  const workspaceInstances = getWorkspaceInstances();
  const workspaceInstanceIds = workspaceInstances.map((instance) => instance.id).join('|');
  const extensionWorkspaceNumber = isWorkspaceExtension
    ? workspaceInstances.filter((instance) => instance.kind === 'extension').findIndex((instance) => instance.id === currentWorkspaceId) + 1
    : 0;
  const extensionWorkspaceLabel = extensionWorkspaceNumber > 0 ? `Workspace ${extensionWorkspaceNumber}` : 'Workspace';
  const canBrowseFolder = typeof getDirectoryPicker() === 'function';
  const canPersistWidgetState = !panelKind && !(currentWorkspaceId === 'main' && bounds.width < 860);
  const clearPendingWidgetSave = () => {
    if (pendingWidgetSaveRef.current === null) return;
    window.clearTimeout(pendingWidgetSaveRef.current);
    pendingWidgetSaveRef.current = null;
  };
  const persistWidgetState = (nextWidgets = widgetsRef.current) => {
    if (!canPersistWidgetState) return;
    clearPendingWidgetSave();
    void saveStoredWidgetState(nextWidgets, currentWorkspaceId);
  };
  const finishInteraction = () => {
    const interaction = interactionRef.current;
    interactionRef.current = null;
    if (interaction?.workspaceId === currentWorkspaceId) {
      persistWidgetState();
    }
  };
  const startWidgetTransferAnimation = useCallback((animation: ActiveWidgetTransferAnimation) => {
    if (transferAnimationTimeoutRef.current !== null) {
      window.clearTimeout(transferAnimationTimeoutRef.current);
      transferAnimationTimeoutRef.current = null;
    }

    setWidgetTransferAnimation(animation);
    transferAnimationTimeoutRef.current = window.setTimeout(() => {
      transferAnimationTimeoutRef.current = null;
      setWidgetTransferAnimation((current) =>
        current?.widgetId === animation.widgetId && current.phase === animation.phase ? null : current,
      );
    }, workspaceTransferAnimationDurationMs);
  }, []);

  const clearTransferCommitTimeouts = (widgetId?: string) => {
    const pendingTimeouts = [];

    for (const pendingTimeout of transferCommitTimeoutsRef.current) {
      if (widgetId && pendingTimeout.widgetId !== widgetId) {
        pendingTimeouts.push(pendingTimeout);
        continue;
      }

      window.clearTimeout(pendingTimeout.id);
    }

    transferCommitTimeoutsRef.current = pendingTimeouts;
  };

  const scheduleTransferSourceCommit = (widgetId: string, nextWidgets: WorkspaceWidget[]) => {
    const timeoutId = window.setTimeout(() => {
      transferCommitTimeoutsRef.current = transferCommitTimeoutsRef.current.filter((pendingTimeout) => pendingTimeout.id !== timeoutId);
      skipNextWidgetSaveRef.current = true;
      setWidgets(nextWidgets);
    }, workspaceTransferOutDurationMs);

    transferCommitTimeoutsRef.current = [...transferCommitTimeoutsRef.current, { id: timeoutId, widgetId }];
  };

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    if (!canPersistWidgetState) return;

    if (skipNextWidgetSaveRef.current) {
      skipNextWidgetSaveRef.current = false;
      return;
    }

    if (interactionRef.current) return;

    pendingWidgetSaveRef.current = window.setTimeout(() => {
      pendingWidgetSaveRef.current = null;
      void saveStoredWidgetState(widgetsRef.current, currentWorkspaceId);
    }, 120);

    return clearPendingWidgetSave;
  }, [canPersistWidgetState, currentWorkspaceId, widgets]);

  useEffect(() =>
    subscribeStoredWidgetState(currentWorkspaceId, () => {
      const nextWidgets = loadWidgetStateForWorkspace(currentWorkspaceId);
      widgetsRef.current = nextWidgets;
      setWidgets(nextWidgets);
    }),
  [currentWorkspaceId]);

  useEffect(() => subscribeWorkspaceInstances(bumpWorkspaceCatalogVersion), [bumpWorkspaceCatalogVersion]);

  useEffect(() => {
    const unsubscribes = workspaceInstanceIds
      .split('|')
      .filter((workspaceId) => workspaceId && workspaceId !== currentWorkspaceId)
      .map((workspaceId) => subscribeStoredWidgetState(workspaceId, bumpWorkspaceCatalogVersion));

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [bumpWorkspaceCatalogVersion, currentWorkspaceId, workspaceInstanceIds]);

  useEffect(() =>
    subscribeWidgetTransfer(currentWorkspaceId, (message) => {
      startWidgetTransferAnimation({
        widgetId: message.widgetId,
        phase: 'incoming',
        direction: message.direction,
      });
    }),
  [currentWorkspaceId, startWidgetTransferAnimation]);

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
    window.addEventListener('pointerup', finishInteraction);
    window.addEventListener('pointercancel', finishInteraction);
    window.addEventListener('blur', finishInteraction);

    return () => {
      window.removeEventListener('pointerup', finishInteraction);
      window.removeEventListener('pointercancel', finishInteraction);
      window.removeEventListener('blur', finishInteraction);
    };
  });

  useEffect(
    () => () => {
      clearPendingWidgetSave();

      if (transferAnimationTimeoutRef.current !== null) {
        window.clearTimeout(transferAnimationTimeoutRef.current);
      }

      clearTransferCommitTimeouts();
    },
    [],
  );

  const orderedWidgets = useMemo(() => widgets.filter((widget) => !widget.hidden).sort((a, b) => a.zIndex - b.zIndex), [widgets]);

  const returnToHub = () => {
    returnToWorkspaceHub();
  };

  const closePanelWindow = () => {
    closeWorkspacePanelWindow();
  };

  const resetWorkspaceLayout = () => {
    interactionRef.current = null;
    setWidgetMenuOpen(false);
    const resetWidgets = currentWorkspaceId === 'main' ? createInitialWidgetState() : createBlankWidgetState();
    widgetsRef.current = resetWidgets;
    void clearAllStoredWidgetStates(getWorkspaceInstances().map((workspace) => workspace.id));
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
    if (!widget || widget.pinned || !planeRef.current) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'drag',
      workspaceId: currentWorkspaceId,
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
      workspaceId: currentWorkspaceId,
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

  const getInteractionWorkspaceWidgets = (workspaceId: string) =>
    workspaceId === currentWorkspaceId ? widgetsRef.current : loadWidgetStateForWorkspace(workspaceId);

  const commitInteractionWorkspaceWidgets = (workspaceId: string, nextWidgets: WorkspaceWidget[]) => {
    if (workspaceId === currentWorkspaceId) {
      widgetsRef.current = nextWidgets;
      setWidgets(nextWidgets);
      return;
    }

    void saveStoredWidgetState(nextWidgets, workspaceId);
  };

  const updateDraggedWidgetPosition = (workspaceId: string, widgetId: string, nextLeft: number, nextTop: number) => {
    const nextWidgets = getInteractionWorkspaceWidgets(workspaceId).map((widget) =>
      widget.id === widgetId
        ? {
            ...widget,
            x: nextLeft,
            y: nextTop,
          }
        : widget,
    );

    commitInteractionWorkspaceWidgets(workspaceId, nextWidgets);
  };

  const transferWidgetToWorkspace = ({
    widget,
    sourceWorkspaceId,
    targetWorkspaceId,
    direction,
  }: {
    widget: WorkspaceWidget;
    sourceWorkspaceId: string;
    targetWorkspaceId: string;
    direction: WorkspaceTransferDirection;
  }) => {
    if (sourceWorkspaceId === currentWorkspaceId) {
      startWidgetTransferAnimation({
        widgetId: widget.id,
        phase: 'outgoing',
        direction,
      });
    }

    const canvasSize = getEffectiveCanvasSize(canvasRef.current, bounds);
    const targetWidgets = getInteractionWorkspaceWidgets(targetWorkspaceId);
    const highestTargetZ = targetWidgets.reduce((max, targetWidget) => Math.max(max, targetWidget.zIndex), 0);
    const landingPosition = getTransferLandingPosition({
      direction,
      widget,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
    });
    const transferredWidget: WorkspaceWidget = {
      ...widget,
      x: landingPosition.x,
      y: landingPosition.y,
      open: true,
      hidden: false,
      zIndex: highestTargetZ + 1,
    };
    const hasTargetWidget = targetWidgets.some((targetWidget) => targetWidget.id === widget.id);
    const nextTargetWidgets = hasTargetWidget
      ? targetWidgets.map((targetWidget) => (targetWidget.id === widget.id ? transferredWidget : targetWidget))
      : [...targetWidgets, transferredWidget];

    if (targetWorkspaceId === currentWorkspaceId) {
      clearTransferCommitTimeouts(widget.id);
      widgetsRef.current = nextTargetWidgets;
      setWidgets(nextTargetWidgets);
      startWidgetTransferAnimation({
        widgetId: widget.id,
        phase: 'incoming',
        direction,
      });
    } else {
      void saveStoredWidgetState(nextTargetWidgets, targetWorkspaceId);
    }

    publishWidgetTransfer({
      widgetId: widget.id,
      sourceWorkspaceId,
      targetWorkspaceId,
      direction,
    });

    const nextSourceWidgets = getInteractionWorkspaceWidgets(sourceWorkspaceId).map((sourceWidget) =>
      sourceWidget.id === widget.id
        ? {
            ...sourceWidget,
            open: false,
            hidden: true,
            pinned: false,
          }
        : sourceWidget,
    );

    if (sourceWorkspaceId === currentWorkspaceId) {
      widgetsRef.current = nextSourceWidgets;
      void saveStoredWidgetState(nextSourceWidgets, currentWorkspaceId);
      scheduleTransferSourceCommit(widget.id, nextSourceWidgets);
    } else {
      void saveStoredWidgetState(nextSourceWidgets, sourceWorkspaceId);
    }

    return transferredWidget;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || !planeRef.current) return;

    const canvasRect = canvasRef.current?.getBoundingClientRect() ?? planeRef.current.getBoundingClientRect();
    const currentWidget = getInteractionWorkspaceWidgets(interaction.workspaceId).find((widget) => widget.id === interaction.id);
    if (!currentWidget) return;

    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;

    if (interaction.mode === 'drag') {
      const proposedLeft = interaction.startLeft + deltaX;
      const proposedTop = interaction.startTop + deltaY;
      const transferDirection = getWorkspaceTransferDirection({
        canvasRect,
        deltaX,
        deltaY,
        pointerX: event.clientX,
        pointerY: event.clientY,
        proposedLeft,
        proposedTop,
        visibleLeft: 0,
        visibleTop: 0,
        widget: currentWidget,
      });
      const transferTarget = transferDirection ? getAdjacentWorkspaceInstance(interaction.workspaceId, transferDirection) : null;

      if (transferDirection && transferTarget && transferTarget.id !== interaction.workspaceId) {
        const transferredWidget = transferWidgetToWorkspace({
          widget: currentWidget,
          sourceWorkspaceId: interaction.workspaceId,
          targetWorkspaceId: transferTarget.id,
          direction: transferDirection,
        });
        interactionRef.current = {
          ...interaction,
          workspaceId: transferTarget.id,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: transferredWidget.x,
          startTop: transferredWidget.y,
          startWidth: transferredWidget.width,
          startHeight: transferredWidget.height,
        };
        return;
      }

      const { left: nextLeft, top: nextTop } = calculatePartiallyOffscreenDragPosition({
        proposedLeft,
        proposedTop,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
        widgetWidth: currentWidget.width,
        widgetHeight: currentWidget.open ? currentWidget.height : 58,
        allowTopOverflow: false,
        minimumVisibleWidth: currentWidget.width,
        minimumVisibleHeight: currentWidget.open ? currentWidget.height : 58,
      });

      updateDraggedWidgetPosition(interaction.workspaceId, interaction.id, nextLeft, nextTop);
      return;
    }

    if (interaction.workspaceId !== currentWorkspaceId) return;

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

    setWidgets((current) => {
      const next = current.map((widget) =>
        widget.id === interaction.id
          ? {
              ...widget,
              x: edge === 'left' ? nextLeft : widget.x,
              y: widget.y,
              width: nextWidth,
              height: nextHeight,
            }
          : widget,
      );
      widgetsRef.current = next;
      return next;
    });
  };

  const stopInteraction = () => {
    finishInteraction();
  };

  const toggleWidget = (id: string) => {
    raiseWidget(id);
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id ? { ...widget, hidden: false, open: !widget.open, zIndex: widget.zIndex + 1 } : widget,
      ),
    );
  };

  const toggleWidgetPin = (id: string) => {
    setWidgets((current) => {
      const next = current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              hidden: false,
              pinned: !widget.pinned,
              zIndex: widget.pinned ? widget.zIndex : widget.zIndex + 1,
            }
          : widget,
      );
      widgetsRef.current = next;
      return next;
    });
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
              open: widget.pinned ? widget.open : false,
              hidden: widget.pinned ? false : true,
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

  const focusManagedWidget = (scopedWidgetId: string) => {
    const { workspaceId, widgetId } = parseManagedWidgetId(scopedWidgetId, currentWorkspaceId);

    if (workspaceId === currentWorkspaceId) {
      focusWidget(widgetId);
      return;
    }

    const targetWidgets = loadWidgetStateForWorkspace(workspaceId);
    const highest = targetWidgets.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
    const nextWidgets = targetWidgets.map((widget) =>
      widget.id === widgetId
        ? {
            ...widget,
            open: true,
            hidden: false,
            zIndex: highest + 1,
          }
        : widget,
    );

    if (saveStoredWidgetState(nextWidgets, workspaceId)) {
      bumpWorkspaceCatalogVersion();
    }
  };

  const toggleManagedWidgetPin = (scopedWidgetId: string) => {
    const { workspaceId, widgetId } = parseManagedWidgetId(scopedWidgetId, currentWorkspaceId);

    if (workspaceId === currentWorkspaceId) {
      toggleWidgetPin(widgetId);
      return;
    }

    const targetWidgets = loadWidgetStateForWorkspace(workspaceId);
    const nextWidgets = targetWidgets.map((widget) =>
      widget.id === widgetId
        ? {
            ...widget,
            hidden: false,
            pinned: !widget.pinned,
            zIndex: widget.pinned ? widget.zIndex : widget.zIndex + 1,
          }
        : widget,
    );

    if (saveStoredWidgetState(nextWidgets, workspaceId)) {
      bumpWorkspaceCatalogVersion();
    }
  };

  const closeManagedWidget = (scopedWidgetId: string) => {
    const { workspaceId, widgetId } = parseManagedWidgetId(scopedWidgetId, currentWorkspaceId);

    if (workspaceId === currentWorkspaceId) {
      closeWidget(widgetId);
      return;
    }

    const targetWidgets = loadWidgetStateForWorkspace(workspaceId);
    const nextWidgets = targetWidgets.map((widget) =>
      widget.id === widgetId
        ? {
            ...widget,
            open: widget.pinned ? widget.open : false,
            hidden: widget.pinned ? false : true,
            zIndex: widget.zIndex + 1,
          }
        : widget,
    );

    if (saveStoredWidgetState(nextWidgets, workspaceId)) {
      bumpWorkspaceCatalogVersion();
    }
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
    setWidgetMenuOpen(false);
    const target = widgetsRef.current.find((widget) => widget.kind === kind);
    if (target) {
      if (!target.open || target.hidden) {
        playWidgetAddedSound();
      }
      openWidgetInCenter(target.id);
      return;
    }

    playWidgetAddedSound();
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
  const workspacePlaneSize = useMemo(() => getWorkspacePlaneSize(bounds), [bounds]);
  const workspaceWidgetGroups = workspaceInstances.map((workspace) => ({
    workspaceId: workspace.id,
    label: workspace.label,
    active: workspace.id === currentWorkspaceId,
    widgets: workspace.id === currentWorkspaceId ? widgets : loadWidgetStateForWorkspace(workspace.id),
  }));
  const widgetRuntimeProps: WorkspaceWidgetRuntimeProps = {
    onStartDrag: startDrag,
    onStartResize: startResize,
    onToggleOpen: toggleWidget,
    onTogglePin: toggleWidgetPin,
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
    workspaceWidgetGroups,
    onFocusWidget: focusManagedWidget,
    onTogglePinWidget: toggleManagedWidgetPin,
    onCloseWidget: closeManagedWidget,
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

      {!isWorkspaceExtension ? <VisualLab /> : null}

      <div className="workspace-head">
        {!isWorkspaceExtension ? <div className="workspace-brand">Mission Control Center</div> : null}
        {!isWorkspaceExtension ? <StatusChip tone="cool">tailnet live · drag · resize · stack</StatusChip> : null}
        {isWorkspaceExtension ? (
          <div className="workspace-extension-identity" aria-label={`${extensionWorkspaceLabel} top bar marker`}>
            <span className="workspace-extension-number">{extensionWorkspaceNumber > 0 ? extensionWorkspaceNumber : '-'}</span>
            <span>{extensionWorkspaceLabel}</span>
          </div>
        ) : null}
        <div className="workspace-launcher">
          {!isWorkspaceExtension ? (
            <WorkspaceButton variant="secondary" className="workspace-launch-button is-muted" onClick={resetWorkspaceLayout}>
              Reset layout
            </WorkspaceButton>
          ) : null}
          {isWorkspaceExtension ? (
            <WorkspaceCloseScreenButton onClick={closeBlankWorkspaceExtension} />
          ) : (
            <WorkspaceNewScreenButton onClick={openBlankWorkspaceExtension} />
          )}
          <div className="workspace-widget-menu">
            <WorkspaceButton
              variant="compact"
              className="workspace-launch-button workspace-widget-menu-trigger"
              aria-expanded={widgetMenuOpen}
              aria-haspopup="menu"
              onClick={() => setWidgetMenuOpen((open) => !open)}
            >
              Open widget
            </WorkspaceButton>
            {widgetMenuOpen ? (
              <div className="workspace-widget-menu-panel" role="menu" aria-label="Open widget menu">
                {workspaceShortcutKinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="workspace-widget-menu-item"
                    role="menuitem"
                    onClick={() => openWorkspaceWidget(kind)}
                  >
                    {getWidgetLabel(kind)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {topBarSlot}
        </div>
      </div>

      <WorkspaceCanvas
        canvasRef={canvasRef}
        planeRef={planeRef}
        planeStyle={workspacePlaneSize}
        onPointerMove={handlePointerMove}
        onPointerUp={stopInteraction}
        onPointerCancel={stopInteraction}
      >
        {orderedWidgets.map((widget) => (
          <WorkspaceWidgetCard
            key={widget.id}
            widget={widget}
            transferAnimation={widgetTransferAnimation?.widgetId === widget.id ? widgetTransferAnimation : null}
            {...widgetRuntimeProps}
          />
        ))}
      </WorkspaceCanvas>

      {!isWorkspaceExtension ? (
        <div className="workspace-footer-tab" aria-label="Workspace footer controls">
          {footerSlot ?? (
            <WorkspaceButton variant="compact" className="workspace-launch-button workspace-footer-button">
              Menu
            </WorkspaceButton>
          )}
          <WorkspaceWindowTracker
            workspaceGroups={workspaceWidgetGroups}
            onFocusWidget={focusManagedWidget}
            onTogglePinWidget={toggleManagedWidgetPin}
            onCloseWidget={closeManagedWidget}
          />
        </div>
      ) : null}
    </section>
  );
}
