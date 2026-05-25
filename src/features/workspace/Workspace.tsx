import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

import { StatusChip } from '../../components/ui/StatusChip';
import { createId } from '../../lib/createId';
import { useDismissibleMenu } from '../../lib/useDismissibleMenu';
import { shellScopes, type ShellRole } from '../shell/roles';
import { useAgentBridgeRuntime } from '../agent-control';
import { useMissionControl } from '../mission-control';
import {
  WorkspaceHud,
  createWorkspaceHudSignals,
  getWorkspaceHudMessage,
  readWorkspaceHudSettings,
  useAgentVoiceRuntime,
  workspaceHudColorOptions,
  workspaceHudDesignOptions,
  writeWorkspaceHudSettings,
  type WorkspaceHudSettings,
} from '../workspace-hud';
import { WorkspaceButton, WorkspaceTopBarButton, WorkspaceTopBarGroup } from './workspaceBlocks';
import { WorkspaceAtmosphere, WorkspaceCanvas } from './WorkspaceCanvas';
import { WorkspaceCloseScreenButton } from './WorkspaceScreenButton';
import { WorkspaceWindowTracker } from './WorkspaceWindowTracker';
import {
  getCurrentFullscreenState,
  isDesktopRuntime,
  setAllOpenWorkspacesFullscreen,
  setCurrentWorkspaceFullscreen,
  subscribeFullscreenState,
} from './workspaceFullscreen';
import type { ResizeEdge } from './WorkspaceResizeHandles';
import type { WorkspaceWidget } from './workspaceTypes';
import { calculateCenteredWidgetPosition, calculatePartiallyOffscreenDragPosition } from './workspaceGeometry';
import { createLocalFileRecord, clearPersistedLocalFiles, generalUseFolderLabel, measureImageDimensions, readFolderEntries, readPersistedLocalFiles, writePersistedLocalFiles, type LocalFileRecord, type LocalFolderEntry, type LocalImageDimensions, type ShowDirectoryPickerFn } from './workspaceLocalFiles';
import {
  clampNumber,
  hasStoredWidgetState,
  loadStoredWidgetState,
  saveStoredWidgetState,
  subscribeStoredWidgetState,
  workspaceDefaultModeId,
} from './workspaceStorage';
import {
  getFocusedWidget,
  getWidgetLabel,
  getWorkspaceShortcutKindsForRole,
  isWorkspaceWidgetAllowedForRole,
  workspaceShortcutKinds,
  widgetBlueprints,
  widgetPresets,
} from './workspaceWidgetCatalog';
import { defaultMarketGraph, getMarketGraph, type MarketGraph } from './workspaceMarketData';
import { useMarketLiveData } from './workspaceMarketLiveData';
import { createWorkspaceModePresetLayout, workspaceModePresets, type WorkspaceModePresetId } from './workspaceModePresets';
import {
  addWorkspaceCustomPreset,
  createWorkspaceCustomPreset,
  createWorkspaceCustomPresetLayout,
  loadWorkspaceCustomPresets,
  removeWorkspaceCustomPreset,
  updateWorkspaceCustomPresetLabel,
  type WorkspaceCustomPreset,
} from './workspaceCustomPresets';
import { WorkspaceWidgetCard, type WorkspaceWidgetRuntimeProps } from './workspaceWidgets';
import { closeWorkspaceExtensionWindow, closeWorkspacePanelWindow, returnToWorkspaceHub } from './workspacePanelWindows';
import { getCurrentShellRole, isWorkspaceExtensionUrl } from './workspacePanelRouting';
import {
  getOpenAdjacentWorkspaceInstance,
  isWorkspaceInstanceOpen,
  getWorkspaceActiveModeId,
  getWorkspaceInstanceId,
  getWorkspaceInstances,
  replaceWorkspaceActiveModeId,
  subscribeWorkspaceInstances,
  updateWorkspaceActiveModeId,
  type WorkspaceTransferDirection,
} from './workspaceInstances';
import { playWidgetAddedSound } from './workspaceSound';
import { publishWidgetTransfer, subscribeWidgetTransfer, type WorkspaceWidgetTransferAnimation } from './workspaceWidgetTransfer';
import {
  editableWorkspacePermissionRoles,
  getDefaultWorkspaceWidgetPermission,
  isWorkspaceWidgetPermittedByPolicy,
  loadWorkspaceWidgetPermissions,
  resetWorkspaceWidgetPermissionRole,
  updateWorkspaceWidgetPermission,
} from './workspaceWidgetPermissions';
import './workspace.css';

const workspaceTransferOutDurationMs = 180;
const workspaceTransferAnimationDurationMs = 240;

const defaultOpenKinds = new Set<WorkspaceWidget['kind']>([
  'command-inbox',
  'notifications',
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

function getDefaultWidgetStateForWorkspace(workspaceId: string) {
  return workspaceId === 'main' ? createInitialWidgetState() : createBlankWidgetState();
}

function loadSavedModeWidgetStateForWorkspace(workspaceId: string, modeId = getWorkspaceActiveModeId(workspaceId)) {
  return loadStoredWidgetState({
    presets: initialWidgetState,
    defaultOpenKinds,
    blueprints: widgetBlueprints,
    workspaceId,
    modeId,
    fallbackToWorkspace: false,
  });
}

function loadWidgetStateForWorkspace(workspaceId: string) {
  const storedWidgets = loadStoredWidgetState({
    presets: initialWidgetState,
    defaultOpenKinds,
    blueprints: widgetBlueprints,
    workspaceId,
  });

  return storedWidgets ?? loadSavedModeWidgetStateForWorkspace(workspaceId) ?? getDefaultWidgetStateForWorkspace(workspaceId);
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
  canvasRect: WorkspaceInteractionRect;
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
  topBarVisualSlot?: ReactNode;
  topBarOperatorSlot?: ReactNode;
  footerSlot?: ReactNode;
  role?: ShellRole;
};

type WorkspaceInteractionRect = Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'>;

type WorkspaceCatalogSnapshot = {
  version: number;
  instances: ReturnType<typeof getWorkspaceInstances>;
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

function WorkspaceTopBarGlyph({ name }: { name: string }) {
  return <span className={`workspace-topbar-glyph workspace-topbar-glyph-${name}`} aria-hidden="true" />;
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

function getCanvasInteractionRect(canvas: HTMLDivElement | null, plane: HTMLDivElement | null) {
  const rect = canvas?.getBoundingClientRect() ?? plane?.getBoundingClientRect();
  return {
    bottom: rect?.bottom ?? 0,
    height: rect?.height ?? 0,
    left: rect?.left ?? 0,
    right: rect?.right ?? 0,
    top: rect?.top ?? 0,
    width: rect?.width ?? 0,
  };
}

function useEventCallback<TArgs extends unknown[], TReturn>(callback: (...args: TArgs) => TReturn) {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args: TArgs) => callbackRef.current(...args), []);
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
  canvasRect: WorkspaceInteractionRect;
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

export function Workspace({
  panelKind = null,
  topBarSlot = null,
  topBarVisualSlot = null,
  topBarOperatorSlot = null,
  footerSlot = null,
  role,
}: WorkspaceProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);
  const activeRole = role ?? getCurrentShellRole();
  const missionControl = useMissionControl(activeRole);
  const agentBridge = useAgentBridgeRuntime({
    localBridgeUrl: import.meta.env.VITE_AGENT_LOCAL_BRIDGE_URL,
    remoteApiUrl: import.meta.env.VITE_AGENT_REMOTE_API_URL,
    onMissionEvents: missionControl.ingestEvents,
  });
  const agentControl = agentBridge.state;
  const marketLiveData = useMarketLiveData();
  const isWorkspaceExtension = isWorkspaceExtensionUrl();
  const workspaceInstanceId = getWorkspaceInstanceId();
  const currentWorkspaceId = isWorkspaceExtension ? workspaceInstanceId ?? 'workspace-extension' : 'main';
  const initialWorkspaceModeId = getWorkspaceActiveModeId(currentWorkspaceId);
  const initialWidgets = useMemo(
    () => (isWorkspaceExtension && !workspaceInstanceId ? createBlankWidgetState() : loadWidgetStateForWorkspace(currentWorkspaceId)),
    [currentWorkspaceId, isWorkspaceExtension, workspaceInstanceId],
  );
  const hasStoredWidgets = hasStoredWidgetState(currentWorkspaceId);
  const widgetsRef = useRef(initialWidgets);
  const interactionRef = useRef<InteractionState | null>(null);
  const maximizedWidgetSnapshotsRef = useRef<Record<string, Pick<WorkspaceWidget, 'x' | 'y' | 'width' | 'height'>>>({});
  const transferAnimationTimeoutRef = useRef<number | null>(null);
  const transferCommitTimeoutsRef = useRef<Array<{ id: number; widgetId: string }>>([]);
  const compactLayoutAppliedRef = useRef(hasStoredWidgets || isWorkspaceExtension);
  const [widgets, setWidgets] = useState(initialWidgets);
  const [workspaceInteractionActive, setWorkspaceInteractionActive] = useState(false);
  const [widgetTransferAnimation, setWidgetTransferAnimation] = useState<ActiveWidgetTransferAnimation | null>(null);
  const pendingWidgetSaveRef = useRef<number | null>(null);
  const pendingWidgetFrameRef = useRef<number | null>(null);
  const pendingWidgetFrameWidgetsRef = useRef<WorkspaceWidget[] | null>(null);
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
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [permissionMenuOpen, setPermissionMenuOpen] = useState(false);
  const [hudMenuOpen, setHudMenuOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [hudSettings, setHudSettings] = useState(readWorkspaceHudSettings);
  const widgetMenuRef = useRef<HTMLDivElement | null>(null);
  const presetMenuRef = useRef<HTMLDivElement | null>(null);
  const permissionMenuRef = useRef<HTMLDivElement | null>(null);
  const hudMenuRef = useRef<HTMLDivElement | null>(null);
  const agentMenuRef = useRef<HTMLDivElement | null>(null);
  const topMenuRefs = useMemo(() => [widgetMenuRef, presetMenuRef, permissionMenuRef, hudMenuRef, agentMenuRef] as const, []);
  const { voiceState } = useAgentVoiceRuntime(hudSettings.voiceReactionEnabled, hudSettings.audioMeterEnabled);
  const [permissionRole, setPermissionRole] = useState<ShellRole>('home');
  const [layoutSaveStatus, setLayoutSaveStatus] = useState('');
  const layoutSaveStatusTimeoutRef = useRef<number | null>(null);
  const [customPresetName, setCustomPresetName] = useState('');
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renamingPresetName, setRenamingPresetName] = useState('');
  const [workspaceFullscreen, setWorkspaceFullscreen] = useState(false);
  const desktopFullscreenAvailable = useMemo(() => isDesktopRuntime(), []);
  const fullscreenRefreshVersionRef = useRef(0);
  const fullscreenToggleInFlightRef = useRef(false);
  const [customPresets, setCustomPresets] = useState(loadWorkspaceCustomPresets);
  const [activeWorkspaceModeId, setActiveWorkspaceModeId] = useState(initialWorkspaceModeId);
  const [widgetPermissions, setWidgetPermissions] = useState(loadWorkspaceWidgetPermissions);
  const [workspaceCatalog, setWorkspaceCatalog] = useState<WorkspaceCatalogSnapshot>(() => ({
    version: 0,
    instances: getWorkspaceInstances(),
  }));
  const bumpWorkspaceCatalogVersion = useCallback(
    () =>
      setWorkspaceCatalog((current) => ({
        version: current.version + 1,
        instances: getWorkspaceInstances(),
      })),
    [],
  );
  const { instances: workspaceInstances, version: workspaceCatalogVersion } = workspaceCatalog;
  const workspaceInstanceIds = useMemo(() => workspaceInstances.map((instance) => instance.id).join('|'), [workspaceInstances]);
  const extensionWorkspaceNumber = isWorkspaceExtension
    ? workspaceInstances.filter((instance) => instance.kind === 'extension').findIndex((instance) => instance.id === currentWorkspaceId) + 1
    : 0;
  const extensionWorkspaceLabel = extensionWorkspaceNumber > 0 ? `Workspace ${extensionWorkspaceNumber}` : 'Workspace';
  const currentWorkspaceLabel = isWorkspaceExtension ? extensionWorkspaceLabel : 'Main workspace';
  const workspaceShortcutKindsForRole = useMemo(
    () => getWorkspaceShortcutKindsForRole(activeRole, widgetPermissions),
    [activeRole, widgetPermissions],
  );
  const canBrowseFolder = typeof getDirectoryPicker() === 'function';
  const canPersistWidgetState = !panelKind && !(currentWorkspaceId === 'main' && bounds.width < 860);
  const closeTopMenus = useCallback(() => {
    setWidgetMenuOpen(false);
    setPresetMenuOpen(false);
    setPermissionMenuOpen(false);
    setHudMenuOpen(false);
    setAgentMenuOpen(false);
  }, []);

  useDismissibleMenu(widgetMenuOpen || presetMenuOpen || permissionMenuOpen || hudMenuOpen || agentMenuOpen, topMenuRefs, closeTopMenus);

  const updateHudSettings = (patch: Partial<WorkspaceHudSettings>) => {
    setHudSettings((current) => {
      const next = {
        ...current,
        ...patch,
      };
      writeWorkspaceHudSettings(next);
      return next;
    });
  };

  const clearPendingWidgetSave = () => {
    if (pendingWidgetSaveRef.current === null) return;
    window.clearTimeout(pendingWidgetSaveRef.current);
    pendingWidgetSaveRef.current = null;
  };
  const flushPendingWidgetFrame = () => {
    if (pendingWidgetFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingWidgetFrameRef.current);
      pendingWidgetFrameRef.current = null;
    }

    const pendingWidgets = pendingWidgetFrameWidgetsRef.current;
    pendingWidgetFrameWidgetsRef.current = null;
    if (pendingWidgets) {
      setWidgets(pendingWidgets);
    }
  };
  const applyWidgetElementFrame = (widget: WorkspaceWidget) => {
    const widgetElement = planeRef.current?.querySelector<HTMLElement>(`[data-widget-id="${widget.id}"]`);
    if (!widgetElement) return;

    widgetElement.style.translate = `${widget.x}px ${widget.y}px`;
    widgetElement.style.width = `${widget.width}px`;
    widgetElement.style.height = `${widget.open ? widget.height : 58}px`;
    widgetElement.style.zIndex = `${widget.zIndex}`;
  };
  const commitCurrentWorkspaceWidgets = (nextWidgets: WorkspaceWidget[], immediate = false) => {
    widgetsRef.current = nextWidgets;

    const interaction = interactionRef.current;
    if (!immediate && import.meta.env.MODE !== 'test' && interaction?.workspaceId === currentWorkspaceId) {
      const activeWidget = nextWidgets.find((widget) => widget.id === interaction.id);
      if (activeWidget) {
        applyWidgetElementFrame(activeWidget);
        return;
      }
    }

    if (immediate || import.meta.env.MODE === 'test') {
      flushPendingWidgetFrame();
      setWidgets(nextWidgets);
      return;
    }

    pendingWidgetFrameWidgetsRef.current = nextWidgets;
    if (pendingWidgetFrameRef.current !== null) return;

    pendingWidgetFrameRef.current = window.requestAnimationFrame(() => {
      pendingWidgetFrameRef.current = null;
      const pendingWidgets = pendingWidgetFrameWidgetsRef.current;
      pendingWidgetFrameWidgetsRef.current = null;
      if (pendingWidgets) {
        setWidgets(pendingWidgets);
      }
    });
  };
  const persistWidgetState = (nextWidgets = widgetsRef.current) => {
    if (!canPersistWidgetState) return;
    clearPendingWidgetSave();
    void saveStoredWidgetState(nextWidgets, currentWorkspaceId);
  };
  const finishInteraction = useEventCallback(() => {
    const interaction = interactionRef.current;
    interactionRef.current = null;
    setWorkspaceInteractionActive(false);
    flushPendingWidgetFrame();
    if (interaction?.workspaceId === currentWorkspaceId) {
      setWidgets(widgetsRef.current);
      persistWidgetState();
    }
  });
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
    setActiveWorkspaceModeId(getWorkspaceActiveModeId(currentWorkspaceId));
  }, [currentWorkspaceId, workspaceCatalogVersion]);

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
  }, [finishInteraction]);

  useEffect(
    () => () => {
      clearPendingWidgetSave();

      if (transferAnimationTimeoutRef.current !== null) {
        window.clearTimeout(transferAnimationTimeoutRef.current);
      }

      if (layoutSaveStatusTimeoutRef.current !== null) {
        window.clearTimeout(layoutSaveStatusTimeoutRef.current);
      }

      if (pendingWidgetFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingWidgetFrameRef.current);
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

  const filterWidgetsForActiveRole = useCallback((nextWidgets: WorkspaceWidget[]) =>
    nextWidgets.map((widget) =>
      isWorkspaceWidgetAllowedForRole(widget.kind, activeRole, widgetPermissions)
        ? widget
        : {
            ...widget,
            open: false,
            hidden: true,
            pinned: false,
          },
    ), [activeRole, widgetPermissions]);

  const workspaceWidgetsChanged = useCallback((left: WorkspaceWidget[], right: WorkspaceWidget[]) =>
    left.length !== right.length ||
    left.some((widget, index) => {
      const nextWidget = right[index];
      return !nextWidget || widget.id !== nextWidget.id || widget.open !== nextWidget.open || widget.hidden !== nextWidget.hidden || widget.pinned !== nextWidget.pinned;
    }), []);

  useEffect(() => {
    if (activeRole === 'admin') return;

    setWidgets((current) => {
      const next = filterWidgetsForActiveRole(current);
      if (!workspaceWidgetsChanged(current, next)) return current;

      widgetsRef.current = next;
      void saveStoredWidgetState(next, currentWorkspaceId);
      return next;
    });
  }, [activeRole, currentWorkspaceId, filterWidgetsForActiveRole, workspaceWidgetsChanged]);

  const getPresetSourceLabel = (preset: WorkspaceCustomPreset) => {
    if (preset.sourceWorkspaceId === 'main') return 'Main workspace';
    return workspaceInstances.find((workspace) => workspace.id === preset.sourceWorkspaceId)?.label ?? preset.sourceWorkspaceId;
  };

  const getPresetMeta = (preset: WorkspaceCustomPreset) => {
    const createdDate = new Date(preset.createdAt);
    const createdLabel = Number.isNaN(createdDate.getTime())
      ? 'saved layout'
      : createdDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const openCount = preset.widgets.filter((widget) => widget.open && !widget.hidden).length;
    return `${getPresetSourceLabel(preset)} · ${createdLabel} · ${openCount} open`;
  };

  const getModeLabel = useCallback((modeId: string) => {
    if (modeId === workspaceDefaultModeId) return 'Manual layout';

    return (
      workspaceModePresets.find((preset) => preset.id === modeId)?.label ??
      customPresets.find((preset) => preset.id === modeId)?.label ??
      'Mode layout'
    );
  }, [customPresets]);

  const createDefaultLayoutForMode = (modeId: string) => {
    const builtInPreset = workspaceModePresets.find((preset) => preset.id === modeId);
    if (builtInPreset) {
      return createWorkspaceModePresetLayout(builtInPreset.id, widgetsRef.current, bounds);
    }

    const customPreset = customPresets.find((preset) => preset.id === modeId);
    if (customPreset) {
      return createWorkspaceCustomPresetLayout(customPreset, widgetsRef.current, bounds);
    }

    return getDefaultWidgetStateForWorkspace(currentWorkspaceId);
  };

  const loadModeLayoutForWorkspace = (modeId: string) =>
    filterWidgetsForActiveRole(loadSavedModeWidgetStateForWorkspace(currentWorkspaceId, modeId) ?? createDefaultLayoutForMode(modeId));

  const commitActiveWorkspaceMode = (modeId: string) => {
    const nextModeId = modeId.trim() || workspaceDefaultModeId;
    updateWorkspaceActiveModeId(currentWorkspaceId, nextModeId);
    setActiveWorkspaceModeId(nextModeId);
    bumpWorkspaceCatalogVersion();
    return nextModeId;
  };

  const showLayoutStatus = useCallback((message: string) => {
    setLayoutSaveStatus(message);
    if (layoutSaveStatusTimeoutRef.current !== null) {
      window.clearTimeout(layoutSaveStatusTimeoutRef.current);
    }

    layoutSaveStatusTimeoutRef.current = window.setTimeout(() => {
      layoutSaveStatusTimeoutRef.current = null;
      setLayoutSaveStatus('');
    }, 2200);
  }, []);

  const refreshWorkspaceFullscreenState = useCallback(() => {
    if (fullscreenToggleInFlightRef.current) {
      return () => undefined;
    }

    let cancelled = false;
    const refreshVersion = fullscreenRefreshVersionRef.current + 1;
    fullscreenRefreshVersionRef.current = refreshVersion;
    void getCurrentFullscreenState().then((fullscreen) => {
      if (!cancelled && fullscreenRefreshVersionRef.current === refreshVersion) {
        setWorkspaceFullscreen(fullscreen);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancelRefresh = refreshWorkspaceFullscreenState();
    const unsubscribe = subscribeFullscreenState(refreshWorkspaceFullscreenState);

    return () => {
      cancelRefresh();
      unsubscribe();
    };
  }, [refreshWorkspaceFullscreenState]);

  const toggleCurrentWorkspaceFullscreen = useCallback(async () => {
    fullscreenToggleInFlightRef.current = true;
    const result = await setCurrentWorkspaceFullscreen(!workspaceFullscreen);
    if (!result.ok || !result.available) {
      fullscreenToggleInFlightRef.current = false;
      showLayoutStatus('Fullscreen unavailable in browser');
      refreshWorkspaceFullscreenState();
      return false;
    }

    fullscreenRefreshVersionRef.current += 1;
    setWorkspaceFullscreen(result.fullscreen);
    window.setTimeout(() => {
      fullscreenToggleInFlightRef.current = false;
    }, 0);
    showLayoutStatus(result.fullscreen ? `${currentWorkspaceLabel} fullscreen` : `${currentWorkspaceLabel} windowed`);
    return true;
  }, [currentWorkspaceLabel, refreshWorkspaceFullscreenState, showLayoutStatus, workspaceFullscreen]);

  const toggleAllOpenWorkspacesFullscreen = async () => {
    fullscreenToggleInFlightRef.current = true;
    const result = await setAllOpenWorkspacesFullscreen(!workspaceFullscreen);
    if (!result.ok || !result.available) {
      fullscreenToggleInFlightRef.current = false;
      showLayoutStatus('Fullscreen unavailable in browser');
      refreshWorkspaceFullscreenState();
      return;
    }

    fullscreenRefreshVersionRef.current += 1;
    setWorkspaceFullscreen(result.fullscreen);
    window.setTimeout(() => {
      fullscreenToggleInFlightRef.current = false;
    }, 0);
    showLayoutStatus(result.fullscreen ? 'All ON workspaces fullscreen' : 'All ON workspaces windowed');
  };

  useEffect(() => {
    const handleFullscreenShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'F11' || event.repeat) return;

      event.preventDefault();
      void toggleCurrentWorkspaceFullscreen();
    };

    window.addEventListener('keydown', handleFullscreenShortcut);
    return () => window.removeEventListener('keydown', handleFullscreenShortcut);
  }, [toggleCurrentWorkspaceFullscreen]);

  const saveWorkspaceLayout = () => {
    closeTopMenus();
    clearPendingWidgetSave();

    const savedWorkingLayout = saveStoredWidgetState(widgetsRef.current, currentWorkspaceId);
    const savedModeLayout = saveStoredWidgetState(widgetsRef.current, currentWorkspaceId, activeWorkspaceModeId);
    showLayoutStatus(savedWorkingLayout && savedModeLayout ? `${currentWorkspaceLabel} ${getModeLabel(activeWorkspaceModeId)} saved` : 'Layout save failed');
  };

  const resetWorkspaceLayout = () => {
    interactionRef.current = null;
    closeTopMenus();
    const resetWidgets = loadModeLayoutForWorkspace(activeWorkspaceModeId);
    widgetsRef.current = resetWidgets;
    void saveStoredWidgetState(resetWidgets, currentWorkspaceId);
    setWidgets(resetWidgets);
    showLayoutStatus(`${currentWorkspaceLabel} reset to ${getModeLabel(activeWorkspaceModeId)}`);
  };

  const closeBlankWorkspaceExtension = () => {
    closeWorkspaceExtensionWindow();
  };

  const applyWorkspaceModePreset = (presetId: WorkspaceModePresetId) => {
    interactionRef.current = null;
    closeTopMenus();
    const preset = workspaceModePresets.find((item) => item.id === presetId);
    const nextModeId = commitActiveWorkspaceMode(presetId);
    const nextWidgets = loadModeLayoutForWorkspace(nextModeId);
    widgetsRef.current = nextWidgets;
    setWidgets(nextWidgets);
    persistWidgetState(nextWidgets);
    showLayoutStatus(`${preset?.label ?? 'Preset'} applied`);
  };

  const applyWorkspaceCustomPreset = (preset: WorkspaceCustomPreset) => {
    interactionRef.current = null;
    closeTopMenus();
    const nextModeId = commitActiveWorkspaceMode(preset.id);
    const nextWidgets = loadModeLayoutForWorkspace(nextModeId);
    widgetsRef.current = nextWidgets;
    setWidgets(nextWidgets);
    persistWidgetState(nextWidgets);
    showLayoutStatus(`${preset.label} applied`);
  };

  const saveWorkspaceCustomPreset = () => {
    const preset = createWorkspaceCustomPreset({
      label: customPresetName,
      sourceWorkspaceId: currentWorkspaceId,
      widgets: widgetsRef.current,
    });
    const nextPresets = addWorkspaceCustomPreset(preset, customPresets);
    setCustomPresets(nextPresets);
    setCustomPresetName('');
    const nextModeId = commitActiveWorkspaceMode(preset.id);
    const savedWorkingLayout = saveStoredWidgetState(widgetsRef.current, currentWorkspaceId);
    const savedModeLayout = saveStoredWidgetState(widgetsRef.current, currentWorkspaceId, nextModeId);
    showLayoutStatus(savedWorkingLayout && savedModeLayout ? `${preset.label} mode created and active` : `${preset.label} mode created`);
  };

  const deleteWorkspaceCustomPreset = (preset: WorkspaceCustomPreset) => {
    const nextPresets = removeWorkspaceCustomPreset(preset.id, customPresets);
    setCustomPresets(nextPresets);
    if (renamingPresetId === preset.id) {
      setRenamingPresetId(null);
      setRenamingPresetName('');
    }

    if (activeWorkspaceModeId === preset.id) {
      setActiveWorkspaceModeId(workspaceDefaultModeId);
    }

    replaceWorkspaceActiveModeId(preset.id, workspaceDefaultModeId);
    bumpWorkspaceCatalogVersion();
    showLayoutStatus(`${preset.label} preset deleted`);
  };

  const startRenamingCustomPreset = (preset: WorkspaceCustomPreset) => {
    setRenamingPresetId(preset.id);
    setRenamingPresetName(preset.label);
  };

  const cancelRenamingCustomPreset = () => {
    setRenamingPresetId(null);
    setRenamingPresetName('');
  };

  const renameWorkspaceCustomPreset = (preset: WorkspaceCustomPreset) => {
    const nextPresets = updateWorkspaceCustomPresetLabel(preset.id, renamingPresetName, customPresets);
    const nextPreset = nextPresets.find((item) => item.id === preset.id) ?? preset;
    setCustomPresets(nextPresets);
    setRenamingPresetId(null);
    setRenamingPresetName('');
    showLayoutStatus(`${nextPreset.label} preset renamed`);
  };

  const getRoleMenuLabel = (roleId: ShellRole) => shellScopes.find((scope) => scope.id === roleId)?.label ?? roleId;

  const setWidgetPermission = (roleId: ShellRole, kind: WorkspaceWidget['kind'], allowed: boolean) => {
    setWidgetPermissions((current) => updateWorkspaceWidgetPermission(current, roleId, kind, allowed));
    showLayoutStatus(`${getRoleMenuLabel(roleId)} ${getWidgetLabel(kind)} ${allowed ? 'visible' : 'hidden'}`);
  };

  const resetWidgetPermissionsForRole = (roleId: ShellRole) => {
    setWidgetPermissions((current) => resetWorkspaceWidgetPermissionRole(current, roleId));
    showLayoutStatus(`${getRoleMenuLabel(roleId)} widget permissions reset`);
  };

  const raiseWidget = (id: string) => {
    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const next = current.map((widget) => (widget.id === id ? { ...widget, zIndex: highest + 1 } : widget));
      widgetsRef.current = next;
      return next;
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a, video, [role="button"]')) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    if (!widget || widget.pinned || !planeRef.current) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    flushPendingWidgetFrame();
    setWorkspaceInteractionActive(true);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'drag',
      workspaceId: currentWorkspaceId,
      pointerId: event.pointerId,
      canvasRect: getCanvasInteractionRect(canvasRef.current, planeRef.current),
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
    flushPendingWidgetFrame();
    setWorkspaceInteractionActive(true);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'resize',
      workspaceId: currentWorkspaceId,
      edge,
      pointerId: event.pointerId,
      canvasRect: getCanvasInteractionRect(canvasRef.current, planeRef.current),
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
      commitCurrentWorkspaceWidgets(nextWidgets);
      return;
    }

    void saveStoredWidgetState(nextWidgets, workspaceId);
  };

  const updateDraggedWidgetPosition = (workspaceId: string, widgetId: string, nextLeft: number, nextTop: number) => {
    const workspaceWidgets = getInteractionWorkspaceWidgets(workspaceId);
    const currentWidget = workspaceWidgets.find((widget) => widget.id === widgetId);
    if (currentWidget?.x === nextLeft && currentWidget.y === nextTop) return;

    const nextWidgets = workspaceWidgets.map((widget) =>
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
      commitCurrentWorkspaceWidgets(nextTargetWidgets, true);
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

    const canvasRect = interaction.canvasRect;
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
      const transferTarget = transferDirection ? getOpenAdjacentWorkspaceInstance(interaction.workspaceId, transferDirection) : null;

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
    let nextTop = interaction.startTop;
    let nextWidth = interaction.startWidth;
    let nextHeight = interaction.startHeight;

    if (edge === 'left') {
      nextLeft = interaction.startLeft + deltaX;
      nextWidth = interaction.startWidth - deltaX;
    } else if (edge === 'right') {
      nextWidth = interaction.startWidth + deltaX;
    } else if (edge === 'top') {
      nextTop = interaction.startTop + deltaY;
      nextHeight = interaction.startHeight - deltaY;
    } else if (edge === 'bottom') {
      nextHeight = interaction.startHeight + deltaY;
    } else {
      nextWidth = interaction.startWidth + deltaX;
      nextHeight = interaction.startHeight + deltaY;
    }

    if (isClosed) {
      nextHeight = interaction.startHeight;
      if (edge !== 'left') nextLeft = interaction.startLeft;
      if (edge === 'top') nextTop = interaction.startTop;
    }

    if (edge === 'top' && nextTop < 0) {
      nextHeight = interaction.startHeight + interaction.startTop;
      nextTop = 0;
    }

    nextWidth = Math.max(currentWidget.minWidth, nextWidth);
    nextHeight = Math.max(currentWidget.minHeight, nextHeight);

    if (edge === 'left' && nextWidth === currentWidget.minWidth) {
      nextLeft = interaction.startLeft + (interaction.startWidth - currentWidget.minWidth);
    }

    if (edge === 'top' && nextHeight === currentWidget.minHeight) {
      nextTop = Math.max(0, interaction.startTop + (interaction.startHeight - currentWidget.minHeight));
    }

    if (
      (edge !== 'left' || currentWidget.x === nextLeft) &&
      (edge !== 'top' || currentWidget.y === nextTop) &&
      currentWidget.width === nextWidth &&
      currentWidget.height === nextHeight
    ) {
      return;
    }

    const nextWidgets = widgetsRef.current.map((widget) =>
      widget.id === interaction.id
        ? {
            ...widget,
            x: edge === 'left' ? nextLeft : widget.x,
            y: edge === 'top' ? nextTop : widget.y,
            width: nextWidth,
            height: nextHeight,
          }
        : widget,
    );
    commitCurrentWorkspaceWidgets(nextWidgets);
  };

  const stopInteraction = () => {
    finishInteraction();
  };

  const toggleWidget = (id: string) => {
    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const next = current.map((widget) =>
        widget.id === id ? { ...widget, hidden: false, open: !widget.open, zIndex: highest + 1 } : widget,
      );
      widgetsRef.current = next;
      return next;
    });
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

  const maximizeWidget = (id: string) => {
    const canvasSize = getEffectiveCanvasSize(canvasRef.current, bounds);

    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const existingSnapshot = maximizedWidgetSnapshotsRef.current[id];

      const next = current.map((widget) => {
        if (widget.id !== id) return widget;

        if (existingSnapshot) {
          return {
            ...widget,
            ...existingSnapshot,
            open: true,
            hidden: false,
            zIndex: highest + 1,
          };
        }

        maximizedWidgetSnapshotsRef.current[id] = {
          x: widget.x,
          y: widget.y,
          width: widget.width,
          height: widget.height,
        };

        return {
          ...widget,
          x: 0,
          y: 0,
          width: Math.max(widget.minWidth, Math.floor(canvasSize.width)),
          height: Math.max(widget.minHeight, Math.floor(canvasSize.height)),
          open: true,
          hidden: false,
          zIndex: highest + 1,
        };
      });

      if (existingSnapshot) {
        delete maximizedWidgetSnapshotsRef.current[id];
      }

      widgetsRef.current = next;
      return next;
    });
  };

  const closeWidget = (id: string) => {
    delete maximizedWidgetSnapshotsRef.current[id];
    setWidgets((current) => {
      const next = current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              open: widget.pinned ? widget.open : false,
              hidden: widget.pinned ? false : true,
              zIndex: widget.zIndex + 1,
            }
          : widget,
      );
      widgetsRef.current = next;
      return next;
    });
  };

  const focusWidget = (id: string, open = true) => {
    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const next = current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              open: open ? true : widget.open,
              hidden: open ? false : widget.hidden,
              zIndex: highest + 1,
            }
          : widget,
      );
      widgetsRef.current = next;
      return next;
    });
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
    if (!isWorkspaceWidgetAllowedForRole(kind, activeRole, widgetPermissions)) return;

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
      const next = [...current, { ...nextWidget, pinned: false, zIndex: highest + 1 }];
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

  const onStartDrag = useEventCallback(startDrag);
  const onStartResize = useEventCallback(startResize);
  const onToggleOpen = useEventCallback(toggleWidget);
  const onTogglePin = useEventCallback(toggleWidgetPin);
  const onMaximize = useEventCallback(maximizeWidget);
  const onRecenter = useEventCallback(recenterWidget);
  const onClose = useEventCallback(closeWidget);
  const onBrowseFiles = useEventCallback(importLocalFiles);
  const onBrowseFolder = useEventCallback(browseFolder);
  const onOpenPreview = useEventCallback(openLocalPreview);
  const onSelectFile = useEventCallback(setSelectedLocalFileId);
  const onClearFiles = useEventCallback(clearLocalFiles);
  const onLaunchWorkspaceWidget = useEventCallback(openWorkspaceWidget);
  const onSelectMarketGraph = useEventCallback(openMarketGraph);
  const onFocusWidget = useEventCallback(focusManagedWidget);
  const onTogglePinWidget = useEventCallback(toggleManagedWidgetPin);
  const onCloseWidget = useEventCallback(closeManagedWidget);

  const activeMarketGraph = useMemo(() => getMarketGraph(activeMarketGraphId), [activeMarketGraphId]);
  const workspacePlaneSize = useMemo(() => getWorkspacePlaneSize(bounds), [bounds]);
  const externalWorkspaceWidgetGroups = useMemo(
    () => {
      const storageRevision = workspaceCatalogVersion;
      void storageRevision;

      return workspaceInstances
        .filter((workspace) => workspace.id !== currentWorkspaceId && isWorkspaceInstanceOpen(workspace))
        .map((workspace) => ({
          workspaceId: workspace.id,
          label: workspace.label,
          active: false,
          widgets: loadWidgetStateForWorkspace(workspace.id),
        }));
    },
    [currentWorkspaceId, workspaceCatalogVersion, workspaceInstances],
  );
  const workspaceWidgetGroups = useMemo(
    () =>
      workspaceInstances.filter(isWorkspaceInstanceOpen).map((workspace) => {
        if (workspace.id === currentWorkspaceId) {
          return {
            workspaceId: workspace.id,
            label: workspace.label,
            active: true,
            widgets,
          };
        }

        return (
          externalWorkspaceWidgetGroups.find((group) => group.workspaceId === workspace.id) ?? {
            workspaceId: workspace.id,
            label: workspace.label,
            active: false,
            widgets: loadWidgetStateForWorkspace(workspace.id),
          }
        );
      }),
    [currentWorkspaceId, externalWorkspaceWidgetGroups, widgets, workspaceInstances],
  );
  const hudLocale = useMemo(() => (typeof navigator === 'undefined' ? 'en' : navigator.language), []);
  const workspaceHudSignals = useMemo(
    () =>
      createWorkspaceHudSignals({
        missionState: missionControl.state,
        agentState: agentControl,
        workspaceGroups: workspaceWidgetGroups,
        activeModeLabel: getModeLabel(activeWorkspaceModeId),
        activeRole,
        locale: hudLocale,
      }),
    [activeRole, activeWorkspaceModeId, agentControl, getModeLabel, hudLocale, missionControl.state, workspaceWidgetGroups],
  );
  const widgetRuntimeProps: WorkspaceWidgetRuntimeProps = {
    onStartDrag,
    onStartResize,
    onToggleOpen,
    onTogglePin,
    onMaximize,
    onRecenter,
    onClose,
    localFiles,
    activeLocalFileId,
    selectedLocalFileId,
    folderEntries,
    folderPath,
    canBrowseFolder,
    activeMarketGraph,
    marketLiveData,
    onBrowseFiles,
    onBrowseFolder,
    onOpenPreview,
    onSelectFile,
    onClearFiles,
    onLaunchWorkspaceWidget,
    onSelectMarketGraph,
    workspaceWidgets: widgets,
    workspaceWidgetGroups,
    onFocusWidget,
    onTogglePinWidget,
    onCloseWidget,
    missionControl,
    agentControl,
    agentTaskGateway: agentBridge.taskGateway,
    activeRole,
    widgetPermissions,
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
    <section className={`workspace-shell${workspaceInteractionActive ? ' is-interacting' : ''}`}>
      <WorkspaceAtmosphere />

      {!isWorkspaceExtension ? (
        <WorkspaceHud
          settings={hudSettings}
          signals={workspaceHudSignals}
          voiceState={voiceState}
          interacting={workspaceInteractionActive}
          locale={hudLocale}
        />
      ) : null}

      <div className="workspace-head">
        {!isWorkspaceExtension ? (
          <div className="workspace-brand workspace-forge-brand" aria-label="Mission Control">
            <span className="workspace-forge-mark" aria-hidden="true">
              <span />
            </span>
            <span className="workspace-forge-copy">
              <strong>Mission Control</strong>
              <small>command rail</small>
            </span>
          </div>
        ) : null}
        {!isWorkspaceExtension ? <StatusChip tone="cool">tailnet live · drag · resize · stack</StatusChip> : null}
        {isWorkspaceExtension ? (
          <div className="workspace-extension-identity" aria-label={`${extensionWorkspaceLabel} top bar marker`}>
            <span className="workspace-extension-number">{extensionWorkspaceNumber > 0 ? extensionWorkspaceNumber : '-'}</span>
            <span>{extensionWorkspaceLabel}</span>
          </div>
        ) : null}
        <div className="workspace-launcher">
          <WorkspaceTopBarGroup id="viewport" label="Viewport controls">
            <WorkspaceTopBarButton
              active={workspaceFullscreen}
              label={workspaceFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              icon={<WorkspaceTopBarGlyph name={workspaceFullscreen ? 'fullscreen-exit' : 'fullscreen'} />}
              onClick={() => void toggleCurrentWorkspaceFullscreen()}
            />
            <WorkspaceTopBarButton
              label="All screens"
              disabled={!desktopFullscreenAvailable}
              title={desktopFullscreenAvailable ? 'Toggle fullscreen for all ON workspaces' : 'Desktop app only'}
              icon={<WorkspaceTopBarGlyph name="all-screens" />}
              onClick={() => void toggleAllOpenWorkspacesFullscreen()}
            />
          </WorkspaceTopBarGroup>
          <WorkspaceTopBarGroup id="layout" label="Layout controls">
            <WorkspaceTopBarButton
              label="Save layout"
              icon={<WorkspaceTopBarGlyph name="save" />}
              onClick={saveWorkspaceLayout}
            />
            <WorkspaceTopBarButton
              label="Reset layout"
              icon={<WorkspaceTopBarGlyph name="reset" />}
              onClick={resetWorkspaceLayout}
            />
          </WorkspaceTopBarGroup>
          <WorkspaceTopBarGroup id="launch" label="Widget launch controls">
          <div className="workspace-widget-menu" ref={widgetMenuRef}>
            <WorkspaceTopBarButton
              label="Open widget"
              className="workspace-widget-menu-trigger"
              icon={<WorkspaceTopBarGlyph name="widgets" />}
              aria-expanded={widgetMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setPresetMenuOpen(false);
                setPermissionMenuOpen(false);
                setHudMenuOpen(false);
                setAgentMenuOpen(false);
                setWidgetMenuOpen((open) => !open);
              }}
            />
            {widgetMenuOpen ? (
              <div className="workspace-widget-menu-panel" role="menu" aria-label="Open widget menu">
                {workspaceShortcutKindsForRole.map((kind) => (
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
          </WorkspaceTopBarGroup>
          <WorkspaceTopBarGroup id="layout" label="Mode controls">
          <div className="workspace-widget-menu workspace-preset-menu" ref={presetMenuRef}>
            <WorkspaceTopBarButton
              label="Mode preset"
              className="workspace-widget-menu-trigger"
              icon={<WorkspaceTopBarGlyph name="mode" />}
              aria-expanded={presetMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setWidgetMenuOpen(false);
                setPermissionMenuOpen(false);
                setHudMenuOpen(false);
                setAgentMenuOpen(false);
                setPresetMenuOpen((open) => !open);
              }}
            >
              Mode preset
            </WorkspaceTopBarButton>
            {presetMenuOpen ? (
              <div className="workspace-widget-menu-panel workspace-preset-menu-panel" role="menu" aria-label="Workspace mode presets">
                <div className="workspace-menu-section-label">Built-in modes</div>
                {workspaceModePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`workspace-widget-menu-item workspace-preset-menu-item${activeWorkspaceModeId === preset.id ? ' is-active' : ''}`}
                    role="menuitem"
                    onClick={() => applyWorkspaceModePreset(preset.id)}
                  >
                    <strong>{preset.label}</strong>
                    <small>Built-in · {preset.note}</small>
                  </button>
                ))}
                <div className="workspace-menu-section-label">Custom presets</div>
                {customPresets.map((preset) => {
                  const isRenaming = renamingPresetId === preset.id;

                  return (
                    <div key={preset.id} className="workspace-preset-row" role="group" aria-label={`${preset.label} preset`}>
                      {isRenaming ? (
                        <div className="workspace-preset-rename">
                          <input
                            value={renamingPresetName}
                            onChange={(event) => setRenamingPresetName(event.target.value)}
                            aria-label={`Rename ${preset.label}`}
                          />
                          <WorkspaceButton
                            variant="compact"
                            className="workspace-launch-button workspace-head-action"
                            role="menuitem"
                            onClick={() => renameWorkspaceCustomPreset(preset)}
                          >
                            Save
                          </WorkspaceButton>
                          <button
                            type="button"
                            className="workspace-preset-delete"
                            role="menuitem"
                            aria-label={`Cancel rename ${preset.label}`}
                            title={`Cancel rename ${preset.label}`}
                            onClick={cancelRenamingCustomPreset}
                          >
                            <span className="widget-control-icon widget-control-icon-close" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`workspace-widget-menu-item workspace-preset-menu-item${activeWorkspaceModeId === preset.id ? ' is-active' : ''}`}
                            role="menuitem"
                            onClick={() => applyWorkspaceCustomPreset(preset)}
                          >
                            <strong>{preset.label}</strong>
                            <small>{getPresetMeta(preset)}</small>
                          </button>
                          <button
                            type="button"
                            className="workspace-preset-delete"
                            role="menuitem"
                            aria-label={`Rename ${preset.label}`}
                            title={`Rename ${preset.label}`}
                            onClick={() => startRenamingCustomPreset(preset)}
                          >
                            <span className="workspace-preset-edit-mark" aria-hidden="true">Aa</span>
                          </button>
                          <button
                            type="button"
                            className="workspace-preset-delete"
                            role="menuitem"
                            aria-label={`Delete ${preset.label}`}
                            title={`Delete ${preset.label}`}
                            onClick={() => deleteWorkspaceCustomPreset(preset)}
                          >
                            <span className="widget-control-icon widget-control-icon-close" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {!customPresets.length ? <div className="workspace-preset-empty">No custom presets saved yet.</div> : null}
                <div className="workspace-preset-create" role="group" aria-label="Create workspace preset">
                  <input
                    value={customPresetName}
                    onChange={(event) => setCustomPresetName(event.target.value)}
                    placeholder={`${currentWorkspaceLabel} preset`}
                    aria-label="Preset name"
                  />
                  <WorkspaceButton variant="compact" className="workspace-launch-button workspace-head-action" onClick={saveWorkspaceCustomPreset}>
                    Create preset
                  </WorkspaceButton>
                </div>
              </div>
            ) : null}
          </div>
          </WorkspaceTopBarGroup>
          {activeRole === 'admin' && !isWorkspaceExtension ? (
            <WorkspaceTopBarGroup id="operator" label="Widget permission controls">
            <div className="workspace-widget-menu workspace-permission-menu" ref={permissionMenuRef}>
              <WorkspaceTopBarButton
                label="Permissions"
                className="workspace-widget-menu-trigger"
                icon={<WorkspaceTopBarGlyph name="permissions" />}
                aria-expanded={permissionMenuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setWidgetMenuOpen(false);
                  setPresetMenuOpen(false);
                  setHudMenuOpen(false);
                  setAgentMenuOpen(false);
                  setPermissionMenuOpen((open) => !open);
                }}
              />
              {permissionMenuOpen ? (
                <div className="workspace-widget-menu-panel workspace-permission-menu-panel" role="menu" aria-label="Widget permissions">
                  <div className="workspace-permission-head">
                    <strong>Widget permissions</strong>
                    <small>Admin sets which widgets each access scope can open. This applies to Open Widget, Launcher, and presets.</small>
                  </div>
                  <div className="workspace-permission-tabs" role="tablist" aria-label="Permission roles">
                    {editableWorkspacePermissionRoles.map((roleId) => {
                      const roleLabel = shellScopes.find((scope) => scope.id === roleId)?.label ?? roleId;

                      return (
                        <button
                          key={roleId}
                          type="button"
                          role="tab"
                          aria-selected={permissionRole === roleId}
                          className={permissionRole === roleId ? 'is-active' : undefined}
                          onClick={() => setPermissionRole(roleId)}
                        >
                          {roleLabel}
                        </button>
                      );
                    })}
                  </div>
                  <div className="workspace-permission-tools">
                    <span>{getRoleMenuLabel(permissionRole)} permissions</span>
                    <WorkspaceButton
                      variant="compact"
                      className="workspace-launch-button workspace-head-action"
                      onClick={() => resetWidgetPermissionsForRole(permissionRole)}
                    >
                      Reset role defaults
                    </WorkspaceButton>
                  </div>
                  <div className="workspace-permission-list">
                    {workspaceShortcutKinds.map((kind) => {
                      const allowed = isWorkspaceWidgetPermittedByPolicy(kind, permissionRole, widgetPermissions);
                      const defaultAllowed = getDefaultWorkspaceWidgetPermission(kind, permissionRole);

                      return (
                        <label key={kind} className="workspace-permission-row">
                          <span>
                            <strong>{getWidgetLabel(kind)}</strong>
                            <small>{allowed ? 'visible' : 'hidden'} Â· {allowed === defaultAllowed ? 'default' : 'custom override'}</small>
                          </span>
                          <input
                            type="checkbox"
                            checked={allowed}
                            onChange={(event) => setWidgetPermission(permissionRole, kind, event.target.checked)}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            </WorkspaceTopBarGroup>
          ) : null}
          {!isWorkspaceExtension ? (
            <WorkspaceTopBarGroup id="visuals" label="Visual controls">
            <div className="workspace-widget-menu workspace-hud-menu" ref={hudMenuRef}>
              <WorkspaceTopBarButton
                label="HUD"
                className="workspace-widget-menu-trigger"
                icon={<WorkspaceTopBarGlyph name="hud" />}
                aria-expanded={hudMenuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setWidgetMenuOpen(false);
                  setPresetMenuOpen(false);
                  setPermissionMenuOpen(false);
                  setAgentMenuOpen(false);
                  setHudMenuOpen((open) => !open);
                }}
              />
              {hudMenuOpen ? (
                <div className="workspace-widget-menu-panel workspace-hud-menu-panel" role="menu" aria-label="HUD menu">
                  <div className="workspace-permission-head">
                    <strong>{getWorkspaceHudMessage('hud.design', hudLocale)}</strong>
                    <small>{workspaceHudSignals.sourceLabel} / {workspaceHudSignals.connection}</small>
                  </div>
                  <div className="workspace-menu-section-label">{getWorkspaceHudMessage('hud.design', hudLocale)}</div>
                  {workspaceHudDesignOptions.map((design) => (
                    <button
                      key={design.id}
                      type="button"
                      className={`workspace-widget-menu-item workspace-hud-menu-item${hudSettings.designId === design.id ? ' is-active' : ''}`}
                      role="menuitemradio"
                      aria-checked={hudSettings.designId === design.id}
                      onClick={() => updateHudSettings({ designId: design.id })}
                    >
                      <strong>{design.label}</strong>
                      <small>{design.description}</small>
                    </button>
                  ))}
                  <div className="workspace-menu-section-label">{getWorkspaceHudMessage('hud.color', hudLocale)}</div>
                  {workspaceHudColorOptions.map((colorMode) => (
                    <button
                      key={colorMode.id}
                      type="button"
                      className={`workspace-widget-menu-item workspace-hud-menu-item${hudSettings.colorMode === colorMode.id ? ' is-active' : ''}`}
                      role="menuitemradio"
                      aria-checked={hudSettings.colorMode === colorMode.id}
                      onClick={() => updateHudSettings({ colorMode: colorMode.id })}
                    >
                      <strong>{colorMode.label}</strong>
                      <small>{colorMode.description}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {topBarVisualSlot}
            </WorkspaceTopBarGroup>
          ) : null}
          {!isWorkspaceExtension ? (
            <WorkspaceTopBarGroup id="operator" label="Agent controls">
            <div className="workspace-widget-menu workspace-agent-menu" ref={agentMenuRef}>
              <WorkspaceTopBarButton
                label="Agent"
                className="workspace-widget-menu-trigger"
                icon={<WorkspaceTopBarGlyph name="agent" />}
                aria-expanded={agentMenuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setWidgetMenuOpen(false);
                  setPresetMenuOpen(false);
                  setPermissionMenuOpen(false);
                  setHudMenuOpen(false);
                  setAgentMenuOpen((open) => !open);
                }}
              />
              {agentMenuOpen ? (
                <div className="workspace-widget-menu-panel workspace-agent-menu-panel" role="menu" aria-label="Agent menu">
                  <div className="workspace-permission-head">
                    <strong>{workspaceHudSignals.agent.name}</strong>
                    <small>{workspaceHudSignals.agent.model} / {workspaceHudSignals.agent.connection}</small>
                  </div>
                  <label className="workspace-hud-toggle-row">
                    <span>
                      <strong>{getWorkspaceHudMessage('hud.voiceReaction', hudLocale)}</strong>
                      <small>{voiceState.source} / {voiceState.status}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={hudSettings.voiceReactionEnabled}
                      onChange={(event) => updateHudSettings({ voiceReactionEnabled: event.target.checked })}
                    />
                  </label>
                  <label className="workspace-hud-toggle-row">
                    <span>
                      <strong>{getWorkspaceHudMessage('hud.audioMeter', hudLocale)}</strong>
                      <small>{voiceState.source === 'microphone' ? `${voiceState.status}` : 'requires microphone permission'}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={hudSettings.audioMeterEnabled}
                      onChange={(event) => updateHudSettings({ audioMeterEnabled: event.target.checked })}
                    />
                  </label>
                  <div className="workspace-hud-menu-actions">
                    <WorkspaceButton
                      variant="compact"
                      className="workspace-launch-button workspace-head-action"
                      onClick={() => {
                        setAgentMenuOpen(false);
                        openWorkspaceWidget('agent-control');
                      }}
                    >
                      {getWorkspaceHudMessage('hud.agentControl', hudLocale)}
                    </WorkspaceButton>
                  </div>
                </div>
              ) : null}
            </div>
            {topBarOperatorSlot ?? topBarSlot}
            </WorkspaceTopBarGroup>
          ) : (
            <WorkspaceTopBarGroup id="operator" label="Workspace window controls">
              <WorkspaceCloseScreenButton onClick={closeBlankWorkspaceExtension} />
            </WorkspaceTopBarGroup>
          )}
          {layoutSaveStatus ? (
            <span className="workspace-layout-status" role="status" aria-live="polite">
              {layoutSaveStatus}
            </span>
          ) : null}
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
