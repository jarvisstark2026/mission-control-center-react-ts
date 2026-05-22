import type { AgentTaskingState } from './agentTaskingTypes';
import { agentTaskingBufferLimits } from './agentTaskingModel';

const agentTaskingStorageKey = 'agent-tasking-state:v1';
const persistedVersion = 1;

type AgentTaskingPersistedSnapshot = {
  version: number;
  messages: AgentTaskingState['messages'];
  proposals: AgentTaskingState['proposals'];
  updatedAt: string;
};

function getStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSnapshot(value: string | null): AgentTaskingPersistedSnapshot | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== persistedVersion) return null;
    if (!Array.isArray(parsed.messages) || !Array.isArray(parsed.proposals)) return null;

    return {
      version: persistedVersion,
      messages: parsed.messages.slice(0, agentTaskingBufferLimits.messages),
      proposals: parsed.proposals.slice(0, agentTaskingBufferLimits.proposals),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function loadPersistedAgentTaskingState(initialState: AgentTaskingState): AgentTaskingState {
  const snapshot = parseSnapshot(getStorage()?.getItem(agentTaskingStorageKey) ?? null);
  if (!snapshot) return initialState;

  return {
    ...initialState,
    messages: snapshot.messages.length ? snapshot.messages : initialState.messages,
    proposals: snapshot.proposals,
    version: initialState.version + 1,
    updatedAt: snapshot.updatedAt,
  };
}

export function savePersistedAgentTaskingState(state: AgentTaskingState) {
  const storage = getStorage();
  if (!storage) return false;

  const snapshot: AgentTaskingPersistedSnapshot = {
    version: persistedVersion,
    messages: state.messages.slice(0, agentTaskingBufferLimits.messages),
    proposals: state.proposals.slice(0, agentTaskingBufferLimits.proposals),
    updatedAt: state.updatedAt,
  };

  try {
    storage.setItem(agentTaskingStorageKey, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedAgentTaskingState() {
  getStorage()?.removeItem(agentTaskingStorageKey);
}
