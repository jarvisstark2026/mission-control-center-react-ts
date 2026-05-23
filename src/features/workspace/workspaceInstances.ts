import { buildWorkspaceHubUrl, isWorkspaceExtensionUrl } from './workspacePanelRouting';
import { readLocalStorageJson, readStorageText, writeLocalStorageJson, writeStorageText } from './browserStorage';
import { workspaceDefaultModeId } from './workspaceStorage';

export type WorkspaceInstance = {
  id: string;
  label: string;
  kind: 'main' | 'extension';
  active: boolean;
  placement: WorkspacePlacement;
  activeModeId: string;
  restoreStatus: WorkspaceRestoreStatus;
  url?: string;
};

export type WorkspacePlacement =
  | 'center'
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';
export type WorkspaceExtensionPlacement = Exclude<WorkspacePlacement, 'center'>;
export type WorkspaceTransferDirection = 'left' | 'right' | 'up' | 'down';
export type WorkspaceRestoreStatus = 'open' | 'restorable';

type StoredWorkspaceInstance = {
  id: string;
  label: string;
  url: string;
  openedAt: number;
  lastSeenAt?: number;
  placement?: WorkspacePlacement;
  activeModeId?: string;
  restoreStatus?: WorkspaceRestoreStatus;
};

type WorkspaceInstanceMessage =
  | { type: 'changed' }
  | { type: 'close'; id: string };

const storageKey = 'mission-control.workspace-instances';
const mainPlacementStorageKey = 'mission-control.workspace-main-placement';
const mainModeStorageKey = 'mission-control.workspace-main-mode';
const channelName = 'mission-control.workspace-instances';
const localEventName = 'mission-control-workspace-instances-change';
const instanceIdParam = 'workspaceId';
const staleInstanceTimeoutMs = 6000;
const openWindows = new Map<string, Window>();
export const maxWorkspaceExtensionInstances = 8;
export const workspacePlacements = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const satisfies readonly WorkspacePlacement[];
export const workspaceExtensionPlacements = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const satisfies readonly WorkspaceExtensionPlacement[];
const defaultWorkspaceExtensionPlacementOrder = [
  'right',
  'left',
  'top',
  'bottom',
  'top-right',
  'bottom-right',
  'top-left',
  'bottom-left',
] as const satisfies readonly WorkspaceExtensionPlacement[];
const workspacePlacementCoordinates: Record<WorkspacePlacement, { column: number; row: number }> = {
  'top-left': { column: 0, row: 0 },
  top: { column: 1, row: 0 },
  'top-right': { column: 2, row: 0 },
  left: { column: 0, row: 1 },
  center: { column: 1, row: 1 },
  right: { column: 2, row: 1 },
  'bottom-left': { column: 0, row: 2 },
  bottom: { column: 1, row: 2 },
  'bottom-right': { column: 2, row: 2 },
};

function createChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(channelName);
}

function readStoredInstances() {
  const parsed = readLocalStorageJson<StoredWorkspaceInstance[]>(storageKey);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((instance) => instance.id && instance.url && instance.label);
}

function writeStoredInstances(instances: StoredWorkspaceInstance[]) {
  writeLocalStorageJson(storageKey, instances);
}

function emitChanged() {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new Event(localEventName));
  const channel = createChannel();
  channel?.postMessage({ type: 'changed' } satisfies WorkspaceInstanceMessage);
  channel?.close();
}

function getDefaultPlacement(index: number): WorkspaceExtensionPlacement {
  return defaultWorkspaceExtensionPlacementOrder[index % defaultWorkspaceExtensionPlacementOrder.length] ?? 'right';
}

function isWorkspacePlacement(placement: unknown): placement is WorkspacePlacement {
  return workspacePlacements.includes(placement as WorkspacePlacement);
}

function getMainWorkspacePlacement() {
  const placement = readStorageText(mainPlacementStorageKey);
  return isWorkspacePlacement(placement) ? placement : 'center';
}

function writeMainWorkspacePlacement(placement: WorkspacePlacement) {
  writeStorageText(mainPlacementStorageKey, placement);
}

function normalizeModeId(modeId: unknown) {
  return typeof modeId === 'string' && modeId.trim() ? modeId.trim() : workspaceDefaultModeId;
}

function getMainWorkspaceModeId() {
  return normalizeModeId(readStorageText(mainModeStorageKey));
}

function writeMainWorkspaceModeId(modeId: string) {
  writeStorageText(mainModeStorageKey, normalizeModeId(modeId));
}

function getStoredRestoreStatus(instance: StoredWorkspaceInstance): WorkspaceRestoreStatus {
  return instance.restoreStatus === 'open' ? 'open' : 'restorable';
}

function getStoredPlacement(instance: StoredWorkspaceInstance, index: number): WorkspacePlacement {
  return isWorkspacePlacement(instance.placement) ? instance.placement : getDefaultPlacement(index);
}

function getNextAvailablePlacement(usedPlacements: Set<WorkspacePlacement>, index: number): WorkspacePlacement {
  const preferredPlacement = getDefaultPlacement(index);
  const fallbackOrder: WorkspacePlacement[] = [preferredPlacement, ...defaultWorkspaceExtensionPlacementOrder, 'center', ...workspacePlacements];

  return fallbackOrder.find((placement) => !usedPlacements.has(placement)) ?? preferredPlacement;
}

function normalizeWorkspaceLayout(instances: StoredWorkspaceInstance[], mainPlacement = getMainWorkspacePlacement()) {
  const normalizedMainPlacement = isWorkspacePlacement(mainPlacement) ? mainPlacement : 'center';
  const usedPlacements = new Set<WorkspacePlacement>([normalizedMainPlacement]);
  const normalizedInstances = instances.map((instance, index) => {
    const storedPlacement = getStoredPlacement(instance, index);
    const placement = usedPlacements.has(storedPlacement)
      ? getNextAvailablePlacement(usedPlacements, index)
      : storedPlacement;

    usedPlacements.add(placement);
    return instance.placement === placement ? instance : { ...instance, placement };
  });

  return {
    instances: normalizedInstances,
    mainPlacement: normalizedMainPlacement,
  };
}

function upsertStoredInstance(instance: StoredWorkspaceInstance) {
  const instances = readStoredInstances();
  const previousIndex = instances.findIndex((item) => item.id === instance.id);
  const previous = previousIndex >= 0 ? instances[previousIndex] : undefined;
  const nextInstance = {
    ...previous,
    ...instance,
    activeModeId: normalizeModeId(instance.activeModeId ?? previous?.activeModeId),
    restoreStatus: instance.restoreStatus ?? previous?.restoreStatus ?? 'open',
    lastSeenAt: instance.lastSeenAt ?? Date.now(),
  };
  const nextInstances =
    previousIndex >= 0 ? instances.map((item, index) => (index === previousIndex ? nextInstance : item)) : [...instances, nextInstance];

  writeStoredInstances(nextInstances);
  emitChanged();
}

function markStoredInstanceRestorable(id: string) {
  const instances = readStoredInstances();
  const nextInstances = instances.map((instance) =>
    instance.id === id
      ? {
          ...instance,
          restoreStatus: 'restorable' as const,
          lastSeenAt: Date.now(),
        }
      : instance,
  );

  writeStoredInstances(nextInstances);
  openWindows.delete(id);
  emitChanged();
}

export function createWorkspaceInstanceId() {
  return `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getWorkspaceInstanceId(search = typeof window === 'undefined' ? '' : window.location.search) {
  return new URLSearchParams(search).get(instanceIdParam);
}

export function getCurrentWorkspaceId() {
  return isWorkspaceExtensionUrl() ? getWorkspaceInstanceId() ?? 'workspace-extension' : 'main';
}

export function appendWorkspaceInstanceId(url: URL, id: string) {
  url.searchParams.set(instanceIdParam, id);
  return url;
}

export function getWorkspaceInstances() {
  const isExtension = isWorkspaceExtensionUrl();
  const activeExtensionId = getWorkspaceInstanceId() ?? (isExtension ? 'workspace-extension' : null);
  const mainUrl = typeof window === 'undefined' ? undefined : buildWorkspaceHubUrl().toString();
  const normalizedLayout = normalizeWorkspaceLayout(readStoredInstances());

  return [
    {
      id: 'main',
      label: 'Main workspace',
      kind: 'main',
      active: !isExtension,
      placement: normalizedLayout.mainPlacement,
      activeModeId: getMainWorkspaceModeId(),
      restoreStatus: 'open',
      url: mainUrl,
    },
    ...normalizedLayout.instances.map((instance, index) => ({
      id: instance.id,
      label: `Workspace ${index + 1}`,
      kind: 'extension' as const,
      active: isExtension && activeExtensionId === instance.id,
      placement: getStoredPlacement(instance, index),
      activeModeId: normalizeModeId(instance.activeModeId),
      restoreStatus: getStoredRestoreStatus(instance),
      url: instance.url,
    })),
  ] satisfies WorkspaceInstance[];
}

export function getAdjacentWorkspaceInstance(sourceWorkspaceId: string, direction: WorkspaceTransferDirection) {
  const instances = getWorkspaceInstances();
  const source = instances.find((instance) => instance.id === sourceWorkspaceId);
  if (!source) return null;

  const sourceCoordinates = workspacePlacementCoordinates[source.placement];
  const targetCoordinates = {
    column: sourceCoordinates.column + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0),
    row: sourceCoordinates.row + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0),
  };
  const targetPlacement = workspacePlacements.find((placement) => {
    const coordinates = workspacePlacementCoordinates[placement];
    return coordinates.column === targetCoordinates.column && coordinates.row === targetCoordinates.row;
  });

  return targetPlacement ? instances.find((instance) => instance.placement === targetPlacement) ?? null : null;
}

export function canCreateWorkspaceExtensionInstance() {
  return readStoredInstances().length < maxWorkspaceExtensionInstances;
}

export function registerWorkspaceExtensionInstance({
  id,
  popup,
  url,
}: {
  id: string;
  popup: Window | null;
  url: string;
}) {
  const now = Date.now();

  if (popup) {
    openWindows.set(id, popup);
  }

  const existingInstances = readStoredInstances();
  const previous = existingInstances.find((instance) => instance.id === id);
  const existingCount = existingInstances.length;
  if (!previous && existingCount >= maxWorkspaceExtensionInstances) return false;

  upsertStoredInstance({
    id,
    label: previous?.label ?? `Workspace ${existingCount + 1}`,
    url,
    openedAt: previous?.openedAt ?? now,
    lastSeenAt: now,
    placement: previous?.placement ?? getDefaultPlacement(existingCount),
    activeModeId: previous?.activeModeId ?? workspaceDefaultModeId,
    restoreStatus: 'open',
  });
  return true;
}

export function markCurrentWorkspaceExtensionOpen() {
  if (!isWorkspaceExtensionUrl()) return null;

  const id = getWorkspaceInstanceId() ?? 'workspace-extension';
  const now = Date.now();
  upsertStoredInstance({
    id,
    label: 'Workspace',
    url: window.location.href,
    openedAt: now,
    lastSeenAt: now,
    restoreStatus: 'open',
  });
  return id;
}

export function getWorkspaceActiveModeId(workspaceId: string) {
  if (workspaceId === 'main') return getMainWorkspaceModeId();

  const instance = readStoredInstances().find((item) => item.id === workspaceId);
  return normalizeModeId(instance?.activeModeId);
}

export function updateWorkspaceActiveModeId(workspaceId: string, modeId: string) {
  const normalizedModeId = normalizeModeId(modeId);

  if (workspaceId === 'main') {
    writeMainWorkspaceModeId(normalizedModeId);
    emitChanged();
    return true;
  }

  const instances = readStoredInstances();
  const hasInstance = instances.some((instance) => instance.id === workspaceId);
  if (!hasInstance) return false;

  writeStoredInstances(instances.map((instance) => (instance.id === workspaceId ? { ...instance, activeModeId: normalizedModeId } : instance)));
  emitChanged();
  return true;
}

export function replaceWorkspaceActiveModeId(previousModeId: string, nextModeId = workspaceDefaultModeId) {
  const previous = normalizeModeId(previousModeId);
  const next = normalizeModeId(nextModeId);
  let changed = false;

  if (getMainWorkspaceModeId() === previous) {
    writeMainWorkspaceModeId(next);
    changed = true;
  }

  const instances = readStoredInstances();
  const nextInstances = instances.map((instance) => {
    if (normalizeModeId(instance.activeModeId) !== previous) return instance;

    changed = true;
    return { ...instance, activeModeId: next };
  });

  if (changed) {
    writeStoredInstances(nextInstances);
    emitChanged();
  }

  return changed;
}

export function updateWorkspaceInstancePlacement(id: string, placement: WorkspacePlacement) {
  if (!isWorkspacePlacement(placement)) return false;

  const normalizedLayout = normalizeWorkspaceLayout(readStoredInstances());
  const instances = normalizedLayout.instances;
  const targetIndex = id === 'main' ? -1 : instances.findIndex((instance) => instance.id === id);
  if (id !== 'main' && targetIndex === -1) return false;

  const targetPreviousPlacement =
    id === 'main' ? normalizedLayout.mainPlacement : getStoredPlacement(instances[targetIndex], targetIndex);
  if (targetPreviousPlacement === placement) return true;

  const occupyingExtension = instances.find((instance, index) => getStoredPlacement(instance, index) === placement);
  const occupyingWorkspace =
    normalizedLayout.mainPlacement === placement
      ? ({ id: 'main', kind: 'main' } as const)
      : occupyingExtension
        ? ({ id: occupyingExtension.id, kind: 'extension' } as const)
        : null;
  let nextMainPlacement = id === 'main' ? placement : normalizedLayout.mainPlacement;
  const nextInstances = instances.map((instance) => {
    if (instance.id === id) {
      return { ...instance, placement };
    }

    if (occupyingWorkspace?.kind === 'extension' && occupyingWorkspace.id === instance.id) {
      return { ...instance, placement: targetPreviousPlacement };
    }

    return instance;
  });

  if (occupyingWorkspace?.kind === 'main') {
    nextMainPlacement = targetPreviousPlacement;
  }

  const finalLayout = normalizeWorkspaceLayout(nextInstances, nextMainPlacement);
  writeMainWorkspacePlacement(finalLayout.mainPlacement);
  writeStoredInstances(finalLayout.instances);
  emitChanged();
  return true;
}

export function markCurrentWorkspaceExtensionClosed() {
  const id = getWorkspaceInstanceId() ?? (isWorkspaceExtensionUrl() ? 'workspace-extension' : null);
  if (!id) return;
  markStoredInstanceRestorable(id);
}

export function pruneClosedWorkspaceInstances() {
  const now = Date.now();
  const closedInstanceIds = readStoredInstances()
    .filter((instance) => {
      if (instance.restoreStatus === 'restorable') return false;
      const popup = openWindows.get(instance.id);

      if (popup) return popup.closed;
      return !instance.lastSeenAt || now - instance.lastSeenAt > staleInstanceTimeoutMs;
    })
    .map((instance) => instance.id);

  if (!closedInstanceIds.length) return false;

  const closedIdSet = new Set(closedInstanceIds);
  writeStoredInstances(
    readStoredInstances().map((instance) =>
      closedIdSet.has(instance.id)
        ? {
            ...instance,
            restoreStatus: 'restorable' as const,
            lastSeenAt: now,
          }
        : instance,
    ),
  );
  closedInstanceIds.forEach((id) => openWindows.delete(id));
  emitChanged();
  return true;
}

export function closeWorkspaceInstance(id: string) {
  if (id === 'main') return false;

  const popup = openWindows.get(id);
  popup?.close();
  markStoredInstanceRestorable(id);

  const channel = createChannel();
  channel?.postMessage({ type: 'close', id } satisfies WorkspaceInstanceMessage);
  channel?.close();
  return true;
}

export function subscribeWorkspaceInstances(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const channel = createChannel();
  const handleMessage = (event: MessageEvent<WorkspaceInstanceMessage>) => {
    if (event.data?.type === 'changed') onChange();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === mainPlacementStorageKey || event.key === mainModeStorageKey) onChange();
  };

  channel?.addEventListener('message', handleMessage);
  window.addEventListener(localEventName, onChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    channel?.removeEventListener('message', handleMessage);
    channel?.close();
    window.removeEventListener(localEventName, onChange);
    window.removeEventListener('storage', handleStorage);
  };
}


export function subscribeWorkspaceInstanceCloseRequests(id: string, onClose: () => void) {
  const channel = createChannel();
  if (!channel) return () => undefined;

  const handleMessage = (event: MessageEvent<WorkspaceInstanceMessage>) => {
    if (event.data?.type === 'close' && event.data.id === id) {
      onClose();
    }
  };

  channel.addEventListener('message', handleMessage);

  return () => {
    channel.removeEventListener('message', handleMessage);
    channel.close();
  };
}
