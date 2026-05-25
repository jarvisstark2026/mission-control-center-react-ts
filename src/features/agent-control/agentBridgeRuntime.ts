import { normalizeMissionControlEventList, type MissionControlEvent } from '../mission-control';
import type {
  AgentActivity,
  AgentConnectorKind,
  AgentConnectorRecord,
  AgentConnectorStatus,
  AgentControlState,
  AgentDescriptor,
  AgentPermission,
  AgentRuntimeProvider,
  AgentScheduledJob,
  AgentUsageSummary,
} from './agentControlTypes';

export type AgentBridgeStatusResponse = {
  status?: AgentConnectorStatus;
  provider?: AgentRuntimeProvider;
  activeEngine?: string | null;
  activeAgentId?: string | null;
  currentTask?: string | null;
  agents?: AgentDescriptor[];
  jobs?: AgentScheduledJob[];
  permissions?: AgentPermission[];
  usage?: AgentUsageSummary;
  activity?: AgentActivity[];
  capabilities?: string[];
  lastSeenAt?: string | null;
  missionControlEvents?: MissionControlEvent[];
};

export type AgentBridgeEvent =
  | { type: 'status'; status: AgentBridgeStatusResponse }
  | { type: 'mission-events'; events: MissionControlEvent[] }
  | { type: 'activity'; activity: AgentActivity[] };

export type AgentBridgeRuntimeState = {
  state: AgentControlState;
  activeConnector: AgentConnectorRecord;
  source: AgentConnectorKind;
};

export type AgentBridgeTransport = {
  connector: AgentConnectorRecord;
  checkStatus: () => Promise<AgentBridgeStatusResponse>;
  connectEvents: (
    onEvent: (event: AgentBridgeEvent) => void,
    onError?: (error: Error) => void,
  ) => { close: () => void };
};

export type AgentBridgeTransportOptions = {
  fetchImpl?: typeof fetch;
  eventSourceFactory?: (url: string) => EventSource;
};

const validConnectorStatuses: AgentConnectorStatus[] = ['connected', 'available', 'offline', 'error', 'not-configured'];
const validProviders: AgentRuntimeProvider[] = ['hermes', 'openclaw', 'openai', 'custom'];
const bridgeActiveStatuses: AgentConnectorStatus[] = ['connected', 'available'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getBridgePath(baseUrl: string, path: 'status' | 'events' | 'tasks') {
  return `${baseUrl.replace(/\/+$/u, '')}/${path}`;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function normalizeConnectorStatus(value: unknown, fallback: AgentConnectorStatus): AgentConnectorStatus {
  return validConnectorStatuses.includes(value as AgentConnectorStatus) ? (value as AgentConnectorStatus) : fallback;
}

function normalizeProvider(value: unknown, fallback: AgentRuntimeProvider): AgentRuntimeProvider {
  return validProviders.includes(value as AgentRuntimeProvider) ? (value as AgentRuntimeProvider) : fallback;
}

function isMissionControlEventList(value: unknown): value is MissionControlEvent[] {
  return Array.isArray(value) && normalizeMissionControlEventList(value).length === value.length;
}

function normalizeBridgeMissionEvents(value: unknown): MissionControlEvent[] {
  return normalizeMissionControlEventList(value);
}

function isAgentActivityList(value: unknown): value is AgentActivity[] {
  return Array.isArray(value);
}

function isAgentDescriptorList(value: unknown): value is AgentDescriptor[] {
  return Array.isArray(value);
}

function isAgentJobList(value: unknown): value is AgentScheduledJob[] {
  return Array.isArray(value);
}

function isAgentPermissionList(value: unknown): value is AgentPermission[] {
  return Array.isArray(value);
}

function isAgentUsageSummary(value: unknown): value is AgentUsageSummary {
  return isRecord(value) && typeof value.requestCount === 'number';
}

export function isAgentBridgeStatusResponse(value: unknown): value is AgentBridgeStatusResponse {
  if (!isRecord(value)) return false;
  if (value.status !== undefined && !validConnectorStatuses.includes(value.status as AgentConnectorStatus)) return false;
  if (value.provider !== undefined && !validProviders.includes(value.provider as AgentRuntimeProvider)) return false;
  if (value.agents !== undefined && !Array.isArray(value.agents)) return false;
  if (value.jobs !== undefined && !Array.isArray(value.jobs)) return false;
  if (value.permissions !== undefined && !Array.isArray(value.permissions)) return false;
  if (value.activity !== undefined && !Array.isArray(value.activity)) return false;
  if (value.missionControlEvents !== undefined && !Array.isArray(value.missionControlEvents)) return false;
  return true;
}

export function normalizeAgentBridgeEvent(payload: unknown): AgentBridgeEvent | null {
  if (isMissionControlEventList(payload)) {
    return { type: 'mission-events', events: normalizeBridgeMissionEvents(payload) };
  }

  if (!isRecord(payload)) return null;

  if (isMissionControlEventList(payload.events)) {
    return { type: 'mission-events', events: normalizeBridgeMissionEvents(payload.events) };
  }

  if (isMissionControlEventList(payload.missionControlEvents)) {
    return { type: 'mission-events', events: normalizeBridgeMissionEvents(payload.missionControlEvents) };
  }

  if (payload.type === 'status' && isAgentBridgeStatusResponse(payload.status)) {
    return { type: 'status', status: payload.status };
  }

  if (payload.type === 'activity' && isAgentActivityList(payload.activity)) {
    return { type: 'activity', activity: payload.activity };
  }

  if (isAgentBridgeStatusResponse(payload) && (payload.status || payload.provider || payload.activeEngine || payload.currentTask)) {
    return { type: 'status', status: payload };
  }

  return null;
}

function connectorPriority(connector: AgentConnectorRecord) {
  if (typeof connector.sourcePriority === 'number') return connector.sourcePriority;
  if (connector.kind === 'local') return 10;
  if (connector.kind === 'remote') return 20;
  return 99;
}

function statusPriority(connector: AgentConnectorRecord) {
  if (connector.status === 'connected') return 0;
  if (connector.status === 'available') return 1;
  return 2;
}

export function selectAgentBridgeConnector(state: AgentControlState): AgentConnectorRecord {
  const activeConnectors = state.connectors
    .filter((connector) => connector.kind !== 'mock' && bridgeActiveStatuses.includes(connector.status))
    .sort((left, right) => statusPriority(left) - statusPriority(right) || connectorPriority(left) - connectorPriority(right));

  return activeConnectors[0] ?? state.connectors.find((connector) => connector.kind === 'mock') ?? state.connectors[0];
}

function replaceConnector(
  state: AgentControlState,
  connectorId: string,
  patch: Partial<AgentConnectorRecord>,
): AgentConnectorRecord[] {
  return state.connectors.map((connector) =>
    connector.id === connectorId
      ? {
          ...connector,
          ...patch,
          capabilities: patch.capabilities ? [...patch.capabilities] : [...connector.capabilities],
        }
      : connector,
  );
}

function getUpdatedState(
  state: AgentControlState,
  connectors: AgentConnectorRecord[],
  patch: Partial<AgentControlState> = {},
): AgentControlState {
  const nextState = {
    ...state,
    ...patch,
    connectors,
    version: state.version + 1,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...nextState,
    activeConnectorId: selectAgentBridgeConnector(nextState).id,
  };
}

export function applyAgentBridgeStatus(
  state: AgentControlState,
  connectorId: string,
  response: AgentBridgeStatusResponse,
  checkedAt = new Date().toISOString(),
): { state: AgentControlState; missionControlEvents: MissionControlEvent[] } {
  const connector = state.connectors.find((item) => item.id === connectorId) ?? state.connectors[0];
  const nextStatus = normalizeConnectorStatus(response.status, 'connected');
  const provider = normalizeProvider(response.provider, connector.provider);
  const activeEngine = response.activeEngine ?? connector.activeEngine ?? null;
  const lastSeenAt = response.lastSeenAt ?? checkedAt;
  const capabilities = Array.isArray(response.capabilities) ? response.capabilities.filter((item) => typeof item === 'string') : connector.capabilities;
  const connectors = replaceConnector(state, connectorId, {
    provider,
    status: nextStatus,
    healthCheckedAt: checkedAt,
    activeEngine,
    lastSeenAt,
    capabilities,
    error: null,
  });

  const statePatch: Partial<AgentControlState> = {
    identity: {
      ...state.identity,
      provider,
      model: activeEngine ?? state.identity.model,
      connection: nextStatus === 'connected' ? 'online' : nextStatus === 'available' ? 'reconnecting' : 'offline',
      currentTask: response.currentTask ?? state.identity.currentTask,
      lastConnectedAt: lastSeenAt ?? state.identity.lastConnectedAt,
    },
  };

  const activeAgentId = getString(response.activeAgentId);
  if (activeAgentId) {
    statePatch.activeAgentId = activeAgentId;
  }

  if (isAgentDescriptorList(response.agents)) {
    statePatch.agents = response.agents;
  }

  if (isAgentJobList(response.jobs)) {
    statePatch.jobs = response.jobs;
  }

  if (isAgentPermissionList(response.permissions)) {
    statePatch.permissions = response.permissions;
  }

  if (isAgentUsageSummary(response.usage)) {
    statePatch.usage = response.usage;
  }

  if (isAgentActivityList(response.activity)) {
    statePatch.activity = response.activity;
  }

  return {
    state: getUpdatedState(state, connectors, statePatch),
    missionControlEvents: normalizeBridgeMissionEvents(response.missionControlEvents),
  };
}

export function markAgentBridgeConnectorFailure(
  state: AgentControlState,
  connectorId: string,
  error: string,
  status: AgentConnectorStatus = 'offline',
): AgentControlState {
  const connectors = replaceConnector(state, connectorId, {
    status,
    healthCheckedAt: new Date().toISOString(),
    error,
  });

  return getUpdatedState(state, connectors);
}

export function applyAgentBridgeEvent(
  state: AgentControlState,
  connectorId: string,
  event: AgentBridgeEvent,
  receivedAt = new Date().toISOString(),
): { state: AgentControlState; missionControlEvents: MissionControlEvent[] } {
  if (event.type === 'mission-events') {
    return { state, missionControlEvents: event.events };
  }

  if (event.type === 'status') {
    return applyAgentBridgeStatus(state, connectorId, event.status, receivedAt);
  }

  return {
    state: {
      ...state,
      activity: [...event.activity, ...state.activity].slice(0, 40),
      version: state.version + 1,
      updatedAt: receivedAt,
    },
    missionControlEvents: [],
  };
}

export function createAgentBridgeTransport(
  connector: AgentConnectorRecord,
  options: AgentBridgeTransportOptions = {},
): AgentBridgeTransport {
  const fetchImpl = options.fetchImpl ?? fetch;
  const eventSourceFactory =
    options.eventSourceFactory ??
    ((url: string) => {
      if (typeof EventSource === 'undefined') {
        throw new Error('SSE is unavailable in this runtime.');
      }
      return new EventSource(url);
    });

  if (!connector.url) {
    throw new Error('Agent bridge connector has no URL.');
  }

  return {
    connector,
    async checkStatus() {
      const response = await fetchImpl(getBridgePath(connector.url as string, 'status'), {
        headers: { accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Agent bridge status returned ${response.status}.`);
      }

      const body: unknown = await response.json();
      if (!isAgentBridgeStatusResponse(body)) {
        throw new Error('Agent bridge status returned an invalid payload.');
      }

      return body;
    },
    connectEvents(onEvent, onError) {
      const source = eventSourceFactory(getBridgePath(connector.url as string, 'events'));

      source.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          const bridgeEvent = normalizeAgentBridgeEvent(parsed);
          if (bridgeEvent) onEvent(bridgeEvent);
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error('Invalid agent bridge SSE event.'));
        }
      };

      source.onerror = () => {
        onError?.(new Error('Agent bridge SSE connection failed.'));
      };

      return {
        close() {
          source.close();
        },
      };
    },
  };
}
