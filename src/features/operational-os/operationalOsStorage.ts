import { readLocalStorageJson, removeLocalStorageItem, writeLocalStorageJson } from '../workspace/browserStorage';
import { createInitialOperationalOsState } from './operationalOsModel';
import type { AppPortalProfile, EvidenceRecord, Goal, JsonSurfaceDocument, OperationalOsState } from './operationalOsTypes';

const operationalOsStorageKey = 'mission-control.operational-os.v1';
const persistedVersion = 1;

type OperationalOsPersistedSnapshot = {
  version: number;
  goals: Goal[];
  evidence: EvidenceRecord[];
  appProfiles: AppPortalProfile[];
  jsonDocuments: JsonSurfaceDocument[];
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGoal(value: unknown): value is Goal {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && Array.isArray(value.commandIds);
}

function isEvidence(value: unknown): value is EvidenceRecord {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && Array.isArray(value.linkedGoalIds);
}

function isAppProfile(value: unknown): value is AppPortalProfile {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.launchTarget === 'string';
}

function isJsonDocument(value: unknown): value is JsonSurfaceDocument {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string' && 'payload' in value;
}

function parseSnapshot(value: unknown): OperationalOsPersistedSnapshot | null {
  if (!isRecord(value) || value.version !== persistedVersion) return null;
  if (!Array.isArray(value.goals) || !Array.isArray(value.evidence) || !Array.isArray(value.appProfiles) || !Array.isArray(value.jsonDocuments)) return null;

  return {
    version: persistedVersion,
    goals: value.goals.filter(isGoal),
    evidence: value.evidence.filter(isEvidence),
    appProfiles: value.appProfiles.filter(isAppProfile),
    jsonDocuments: value.jsonDocuments.filter(isJsonDocument),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

export function loadPersistedOperationalOsState(): OperationalOsState {
  const initialState = createInitialOperationalOsState();
  const snapshot = parseSnapshot(readLocalStorageJson<unknown>(operationalOsStorageKey));
  if (!snapshot) return initialState;

  return {
    ...initialState,
    goals: snapshot.goals.length ? snapshot.goals : initialState.goals,
    evidence: snapshot.evidence.length ? snapshot.evidence : initialState.evidence,
    appProfiles: snapshot.appProfiles.length ? snapshot.appProfiles : initialState.appProfiles,
    jsonDocuments: snapshot.jsonDocuments.length ? snapshot.jsonDocuments : initialState.jsonDocuments,
    version: initialState.version + 1,
    updatedAt: snapshot.updatedAt,
  };
}

export function savePersistedOperationalOsState(state: OperationalOsState) {
  const snapshot: OperationalOsPersistedSnapshot = {
    version: persistedVersion,
    goals: state.goals,
    evidence: state.evidence,
    appProfiles: state.appProfiles,
    jsonDocuments: state.jsonDocuments,
    updatedAt: state.updatedAt,
  };

  return writeLocalStorageJson(operationalOsStorageKey, snapshot);
}

export function clearPersistedOperationalOsState() {
  return removeLocalStorageItem(operationalOsStorageKey);
}
