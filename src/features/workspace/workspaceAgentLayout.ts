import { readLocalStorageJson, writeLocalStorageJson } from './browserStorage';
import { workspacePlacements, type WorkspacePlacement } from './workspaceInstances';
import type { WidgetKind, WorkspaceWidget } from './workspaceTypes';

export type AgentLiveLayoutStatus = 'off' | 'listening' | 'moving' | 'paused by user' | 'bridge unavailable';

export type AgentLiveLayoutWorkspaceState = {
  enabled: boolean;
  status: AgentLiveLayoutStatus;
  workspaceId: string;
  placement: WorkspacePlacement;
  bridgeUrl: string | null;
  activeWidgetIds: string[];
  lastDirectiveAt: string | null;
  lastError: string | null;
};

export type AgentLiveLayoutControlState = AgentLiveLayoutWorkspaceState;

export type AgentLiveLayoutGlobalState = {
  bridgeUrl: string | null;
  updatedAt: string;
  workspaces: Record<WorkspacePlacement, AgentLiveLayoutWorkspaceState>;
};

export type WorkspaceLayoutSnapshot = {
  workspaceId: string;
  canvas: { width: number; height: number };
  widgets: Array<{
    id: string;
    kind: WidgetKind;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    open: boolean;
    hidden?: boolean;
    pinned?: boolean;
    zIndex: number;
  }>;
  locks: {
    userDraggingWidgetId?: string;
    userResizingWidgetId?: string;
    agentAnimatingWidgetIds: string[];
  };
};

export type WorkspaceLayoutDirective = {
  id: string;
  workspaceId: string;
  widgetId: string;
  action: 'move' | 'resize' | 'move-resize' | 'open' | 'minimize' | 'focus';
  target?: { x?: number; y?: number; width?: number; height?: number };
  path?: Array<{ x: number; y: number; t?: number }>;
  durationMs?: number;
  easing?: 'linear' | 'ease-out' | 'ease-in-out';
  reason?: string;
};

export type ValidatedWorkspaceLayoutDirective = WorkspaceLayoutDirective & {
  target: { x: number; y: number; width: number; height: number };
  durationMs: number;
  easing: 'linear' | 'ease-out' | 'ease-in-out';
};

export type WorkspaceLayoutValidationResult = {
  accepted: ValidatedWorkspaceLayoutDirective[];
  rejected: string[];
};

const layoutActions = new Set<WorkspaceLayoutDirective['action']>(['move', 'resize', 'move-resize', 'open', 'minimize', 'focus']);
const maxDirectiveDurationMs = 1600;
const defaultDirectiveDurationMs = 520;
const agentLiveLayoutStorageKey = 'mission-control.agent-live-layout';
const agentLiveLayoutChannelName = 'mission-control.agent-live-layout';
const agentLiveLayoutEventName = 'mission-control-agent-live-layout-change';

export const agentLiveLayoutPlacementLabels: Record<WorkspacePlacement, string> = {
  'top-left': 'Top-left',
  top: 'Top',
  'top-right': 'Top-right',
  left: 'Left',
  center: 'Main workspace',
  right: 'Right',
  'bottom-left': 'Bottom-left',
  bottom: 'Bottom',
  'bottom-right': 'Bottom-right',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createAgentLiveLayoutChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(agentLiveLayoutChannelName);
}

function getIsoTimestamp() {
  return new Date().toISOString();
}

function createDefaultWorkspaceLiveLayoutState(placement: WorkspacePlacement): AgentLiveLayoutWorkspaceState {
  return {
    enabled: false,
    status: 'off',
    workspaceId: placement === 'center' ? 'main' : `placement:${placement}`,
    placement,
    bridgeUrl: null,
    activeWidgetIds: [],
    lastDirectiveAt: null,
    lastError: null,
  };
}

function createDefaultAgentLiveLayoutGlobalState(): AgentLiveLayoutGlobalState {
  return {
    bridgeUrl: null,
    updatedAt: getIsoTimestamp(),
    workspaces: Object.fromEntries(
      workspacePlacements.map((placement) => [placement, createDefaultWorkspaceLiveLayoutState(placement)]),
    ) as Record<WorkspacePlacement, AgentLiveLayoutWorkspaceState>,
  };
}

function normalizeWorkspaceLiveLayoutState(placement: WorkspacePlacement, value: unknown): AgentLiveLayoutWorkspaceState {
  const fallback = createDefaultWorkspaceLiveLayoutState(placement);
  if (!isRecord(value)) return fallback;
  const status = value.status;
  return {
    enabled: value.enabled === true,
    status:
      status === 'off' || status === 'listening' || status === 'moving' || status === 'paused by user' || status === 'bridge unavailable'
        ? status
        : value.enabled === true
          ? 'listening'
          : 'off',
    workspaceId: typeof value.workspaceId === 'string' && value.workspaceId.trim() ? value.workspaceId.trim() : fallback.workspaceId,
    placement,
    bridgeUrl: typeof value.bridgeUrl === 'string' && value.bridgeUrl.trim() ? value.bridgeUrl.trim() : null,
    activeWidgetIds: Array.isArray(value.activeWidgetIds)
      ? value.activeWidgetIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
      : [],
    lastDirectiveAt: typeof value.lastDirectiveAt === 'string' ? value.lastDirectiveAt : null,
    lastError: typeof value.lastError === 'string' ? value.lastError : null,
  };
}

export function normalizeAgentLiveLayoutGlobalState(value: unknown): AgentLiveLayoutGlobalState {
  const fallback = createDefaultAgentLiveLayoutGlobalState();
  if (!isRecord(value)) return fallback;
  const storedWorkspaces = isRecord(value.workspaces) ? value.workspaces : {};
  return {
    bridgeUrl: typeof value.bridgeUrl === 'string' && value.bridgeUrl.trim() ? value.bridgeUrl.trim() : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    workspaces: Object.fromEntries(
      workspacePlacements.map((placement) => [
        placement,
        normalizeWorkspaceLiveLayoutState(placement, storedWorkspaces[placement]),
      ]),
    ) as Record<WorkspacePlacement, AgentLiveLayoutWorkspaceState>,
  };
}

export function readAgentLiveLayoutGlobalState(): AgentLiveLayoutGlobalState {
  return normalizeAgentLiveLayoutGlobalState(readLocalStorageJson(agentLiveLayoutStorageKey));
}

function emitAgentLiveLayoutChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(agentLiveLayoutEventName));
  const channel = createAgentLiveLayoutChannel();
  channel?.postMessage({ type: 'changed' });
  channel?.close();
}

export function writeAgentLiveLayoutGlobalState(state: AgentLiveLayoutGlobalState) {
  writeLocalStorageJson(agentLiveLayoutStorageKey, state);
  emitAgentLiveLayoutChange();
}

export function updateAgentLiveLayoutGlobalState(
  updater: (state: AgentLiveLayoutGlobalState) => AgentLiveLayoutGlobalState,
) {
  const next = updater(readAgentLiveLayoutGlobalState());
  writeAgentLiveLayoutGlobalState(next);
  return next;
}

export function subscribeAgentLiveLayoutGlobalState(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const channel = createAgentLiveLayoutChannel();
  const handleChange = () => onChange();
  channel?.addEventListener('message', handleChange);
  window.addEventListener(agentLiveLayoutEventName, handleChange);
  window.addEventListener('storage', handleChange);
  return () => {
    channel?.removeEventListener('message', handleChange);
    channel?.close();
    window.removeEventListener(agentLiveLayoutEventName, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}

export function getAgentLiveLayoutWorkspaceState(
  state: AgentLiveLayoutGlobalState,
  placement: WorkspacePlacement,
  workspaceId: string,
): AgentLiveLayoutWorkspaceState {
  const workspaceState = state.workspaces[placement] ?? createDefaultWorkspaceLiveLayoutState(placement);
  return workspaceState.workspaceId === workspaceId
    ? workspaceState
    : {
        ...workspaceState,
        workspaceId,
      };
}

export function setAgentLiveLayoutWorkspaceEnabled(
  placement: WorkspacePlacement,
  workspaceId: string,
  enabled: boolean,
  bridgeUrl: string | null,
) {
  return updateAgentLiveLayoutGlobalState((state) => {
    const current = normalizeWorkspaceLiveLayoutState(placement, state.workspaces[placement]);
    return {
      ...state,
      bridgeUrl,
      updatedAt: getIsoTimestamp(),
      workspaces: {
        ...state.workspaces,
        [placement]: {
          ...current,
          workspaceId,
          enabled,
          status: enabled ? 'listening' : 'off',
          bridgeUrl,
          activeWidgetIds: enabled ? current.activeWidgetIds : [],
          lastError: enabled ? null : current.lastError,
        },
      },
    };
  });
}

export function setAllAgentLiveLayoutWorkspacesEnabled(enabled: boolean, bridgeUrl: string | null) {
  return updateAgentLiveLayoutGlobalState((state) => ({
    ...state,
    bridgeUrl,
    updatedAt: getIsoTimestamp(),
    workspaces: Object.fromEntries(
      workspacePlacements.map((placement) => {
        const current = normalizeWorkspaceLiveLayoutState(placement, state.workspaces[placement]);
        return [
          placement,
          {
            ...current,
            enabled,
            status: enabled ? 'listening' : 'off',
            bridgeUrl,
            activeWidgetIds: enabled ? current.activeWidgetIds : [],
            lastError: enabled ? null : current.lastError,
          },
        ];
      }),
    ) as unknown as Record<WorkspacePlacement, AgentLiveLayoutWorkspaceState>,
  }));
}

export function pauseAllAgentLiveLayoutWorkspaces(bridgeUrl: string | null) {
  return updateAgentLiveLayoutGlobalState((state) => ({
    ...state,
    bridgeUrl,
    updatedAt: getIsoTimestamp(),
    workspaces: Object.fromEntries(
      workspacePlacements.map((placement) => {
        const current = normalizeWorkspaceLiveLayoutState(placement, state.workspaces[placement]);
        return [
          placement,
          {
            ...current,
            enabled: false,
            status: 'paused by user' as const,
            bridgeUrl,
            activeWidgetIds: [],
          },
        ];
      }),
    ) as unknown as Record<WorkspacePlacement, AgentLiveLayoutWorkspaceState>,
  }));
}

export function reportAgentLiveLayoutWorkspaceStatus(
  placement: WorkspacePlacement,
  workspaceId: string,
  patch: Partial<AgentLiveLayoutWorkspaceState>,
) {
  return updateAgentLiveLayoutGlobalState((state) => {
    const current = normalizeWorkspaceLiveLayoutState(placement, state.workspaces[placement]);
    const bridgeUrl = patch.bridgeUrl === undefined ? current.bridgeUrl : patch.bridgeUrl;
    return {
      ...state,
      bridgeUrl: bridgeUrl ?? state.bridgeUrl,
      updatedAt: getIsoTimestamp(),
      workspaces: {
        ...state.workspaces,
        [placement]: {
          ...current,
          ...patch,
          workspaceId,
          placement,
          bridgeUrl,
          activeWidgetIds: patch.activeWidgetIds ?? current.activeWidgetIds,
        },
      },
    };
  });
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function normalizeDuration(value: unknown) {
  const duration = getFiniteNumber(value) ?? defaultDirectiveDurationMs;
  return clamp(duration, 120, maxDirectiveDurationMs);
}

function normalizeEasing(value: unknown): ValidatedWorkspaceLayoutDirective['easing'] {
  return value === 'linear' || value === 'ease-in-out' || value === 'ease-out' ? value : 'ease-out';
}

function normalizeDirective(value: unknown): WorkspaceLayoutDirective | null {
  if (!isRecord(value)) return null;
  const action = value.action as WorkspaceLayoutDirective['action'];
  if (!layoutActions.has(action)) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : `layout-${Date.now().toString(36)}`;
  const workspaceId = typeof value.workspaceId === 'string' ? value.workspaceId.trim() : '';
  const widgetId = typeof value.widgetId === 'string' ? value.widgetId.trim() : '';
  if (!workspaceId || !widgetId) return null;

  const targetRecord = isRecord(value.target) ? value.target : {};
  const path = Array.isArray(value.path)
    ? value.path
        .slice(0, 8)
        .map((point) => {
          if (!isRecord(point)) return null;
          const x = getFiniteNumber(point.x);
          const y = getFiniteNumber(point.y);
          if (x === null || y === null) return null;
          const t = getFiniteNumber(point.t);
          return t === null ? { x, y } : { x, y, t };
        })
        .filter((point): point is { x: number; y: number; t?: number } => Boolean(point))
    : undefined;

  return {
    id,
    workspaceId,
    widgetId,
    action,
    target: {
      x: getFiniteNumber(targetRecord.x) ?? undefined,
      y: getFiniteNumber(targetRecord.y) ?? undefined,
      width: getFiniteNumber(targetRecord.width) ?? undefined,
      height: getFiniteNumber(targetRecord.height) ?? undefined,
    },
    path: path?.length ? path : undefined,
    durationMs: normalizeDuration(value.durationMs),
    easing: normalizeEasing(value.easing),
    reason: typeof value.reason === 'string' ? value.reason : undefined,
  };
}

export function normalizeWorkspaceLayoutDirectives(value: unknown): WorkspaceLayoutDirective[] {
  const payload = isRecord(value) && Array.isArray(value.directives) ? value.directives : Array.isArray(value) ? value : [];
  return payload.map(normalizeDirective).filter((directive): directive is WorkspaceLayoutDirective => Boolean(directive));
}

export function createWorkspaceLayoutSnapshot({
  workspaceId,
  canvas,
  widgets,
  locks,
}: {
  workspaceId: string;
  canvas: { width: number; height: number };
  widgets: WorkspaceWidget[];
  locks: WorkspaceLayoutSnapshot['locks'];
}): WorkspaceLayoutSnapshot {
  return {
    workspaceId,
    canvas: {
      width: Math.max(320, Math.floor(canvas.width)),
      height: Math.max(240, Math.floor(canvas.height)),
    },
    widgets: widgets.map((widget) => ({
      id: widget.id,
      kind: widget.kind,
      title: widget.title,
      x: widget.x,
      y: widget.y,
      width: widget.width,
      height: widget.height,
      minWidth: widget.minWidth,
      minHeight: widget.minHeight,
      open: widget.open,
      hidden: widget.hidden,
      pinned: widget.pinned,
      zIndex: widget.zIndex,
    })),
    locks,
  };
}

export function validateWorkspaceLayoutDirectives(
  directives: WorkspaceLayoutDirective[],
  snapshot: WorkspaceLayoutSnapshot,
): WorkspaceLayoutValidationResult {
  const widgetById = new Map(snapshot.widgets.map((widget) => [widget.id, widget]));
  const rejected: string[] = [];
  const accepted: ValidatedWorkspaceLayoutDirective[] = [];
  const lockedWidgetIds = new Set([
    snapshot.locks.userDraggingWidgetId,
    snapshot.locks.userResizingWidgetId,
    ...snapshot.locks.agentAnimatingWidgetIds,
  ].filter((id): id is string => Boolean(id)));

  for (const directive of directives) {
    const widget = widgetById.get(directive.widgetId);
    if (!widget) {
      rejected.push(`${directive.id}: unknown widget ${directive.widgetId}`);
      continue;
    }
    if (directive.workspaceId !== snapshot.workspaceId) {
      rejected.push(`${directive.id}: workspace mismatch`);
      continue;
    }
    if (widget.hidden) {
      rejected.push(`${directive.id}: hidden widget ${widget.title} is not live-controllable`);
      continue;
    }
    if (widget.pinned) {
      rejected.push(`${directive.id}: pinned widget ${widget.title} is user-locked`);
      continue;
    }
    if (lockedWidgetIds.has(widget.id)) {
      rejected.push(`${directive.id}: ${widget.title} is locked by the user or another movement`);
      continue;
    }

    const targetWidth = Math.max(widget.minWidth, directive.target?.width ?? widget.width);
    const targetHeight = Math.max(widget.minHeight, directive.target?.height ?? widget.height);
    const targetX = directive.action === 'resize'
      ? widget.x
      : clamp(directive.target?.x ?? directive.path?.at(-1)?.x ?? widget.x, 0, snapshot.canvas.width - targetWidth);
    const targetY = directive.action === 'resize'
      ? widget.y
      : clamp(directive.target?.y ?? directive.path?.at(-1)?.y ?? widget.y, 0, snapshot.canvas.height - targetHeight);

    accepted.push({
      ...directive,
      target: {
        x: targetX,
        y: targetY,
        width: Math.min(targetWidth, snapshot.canvas.width),
        height: Math.min(targetHeight, snapshot.canvas.height),
      },
      path: directive.path?.map((point) => ({
        ...point,
        x: clamp(point.x, 0, snapshot.canvas.width - targetWidth),
        y: clamp(point.y, 0, snapshot.canvas.height - targetHeight),
      })),
      durationMs: normalizeDuration(directive.durationMs),
      easing: normalizeEasing(directive.easing),
    });
  }

  return { accepted, rejected };
}

export async function requestWorkspaceLayoutPlan(
  bridgeUrl: string,
  snapshot: WorkspaceLayoutSnapshot,
  fetchImpl: typeof fetch = fetch,
): Promise<WorkspaceLayoutDirective[]> {
  const trimmedUrl = bridgeUrl.trim().replace(/\/+$/u, '');
  if (!trimmedUrl) throw new Error('Agent bridge URL is not configured.');

  const response = await fetchImpl(`${trimmedUrl}/workspace/layout/plan`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(snapshot),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : `Agent layout bridge returned ${response.status}.`;
    throw new Error(message);
  }

  return normalizeWorkspaceLayoutDirectives(payload);
}
