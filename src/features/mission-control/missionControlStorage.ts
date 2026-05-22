import type { CommandRequest, MissionControlState, MissionNotification } from './missionControlTypes';
import { missionControlBufferLimits } from './missionControlReducer';

const missionControlStorageKey = 'mission-control-state:v1';
const persistedVersion = 1;

type MissionControlPersistedSnapshot = {
  version: number;
  commands: CommandRequest[];
  notifications: MissionNotification[];
  lastUpdatedAt: string;
};

function getStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCommandRequest(value: unknown): value is CommandRequest {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && Array.isArray(value.auditTrail);
}

function isMissionNotification(value: unknown): value is MissionNotification {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string';
}

function parseSnapshot(value: string | null): MissionControlPersistedSnapshot | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== persistedVersion) return null;
    if (!Array.isArray(parsed.commands) || !Array.isArray(parsed.notifications)) return null;

    return {
      version: persistedVersion,
      commands: parsed.commands.filter(isCommandRequest).slice(0, missionControlBufferLimits.commands),
      notifications: parsed.notifications.filter(isMissionNotification).slice(0, missionControlBufferLimits.notifications),
      lastUpdatedAt: typeof parsed.lastUpdatedAt === 'string' ? parsed.lastUpdatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function mergeById<T extends { id: string }>(baseItems: T[], persistedItems: T[], limit: number) {
  const byId = new Map(baseItems.map((item) => [item.id, item]));

  persistedItems.forEach((item) => {
    byId.set(item.id, item);
  });

  return Array.from(byId.values()).slice(0, limit);
}

export function loadPersistedMissionControlState(initialState: MissionControlState): MissionControlState {
  const snapshot = parseSnapshot(getStorage()?.getItem(missionControlStorageKey) ?? null);
  if (!snapshot) return initialState;

  return {
    ...initialState,
    commands: mergeById(initialState.commands, snapshot.commands, missionControlBufferLimits.commands),
    notifications: mergeById(initialState.notifications, snapshot.notifications, missionControlBufferLimits.notifications),
    version: initialState.version + 1,
    lastUpdatedAt: snapshot.lastUpdatedAt,
  };
}

export function savePersistedMissionControlState(state: MissionControlState) {
  const storage = getStorage();
  if (!storage) return false;

  const snapshot: MissionControlPersistedSnapshot = {
    version: persistedVersion,
    commands: state.commands.slice(0, missionControlBufferLimits.commands),
    notifications: state.notifications.slice(0, missionControlBufferLimits.notifications),
    lastUpdatedAt: state.lastUpdatedAt,
  };

  try {
    storage.setItem(missionControlStorageKey, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedMissionControlState() {
  getStorage()?.removeItem(missionControlStorageKey);
}
