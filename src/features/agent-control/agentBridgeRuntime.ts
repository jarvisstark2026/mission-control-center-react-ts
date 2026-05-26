import { normalizeMissionControlEventList, type MissionControlEvent } from '../mission-control';
import type {
  AgentActivity,
  AgentBridgeDiagnostic,
  AgentBridgeDiagnosticLevel,
  AgentBridgeDiagnosticSource,
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
  status?: AgentConnectorStatus | 'ok';
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

export type AgentBridgeProbeResult = {
  url: string;
  ok: boolean;
  status?: AgentConnectorStatus;
  provider?: AgentRuntimeProvider;
  activeEngine?: string;
  error?: string;
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
const validBridgeStatusAliases = ['ok', 'up', 'ready', 'healthy', 'online', 'down', 'unreachable', 'upstream_error'];
const validProviders: AgentRuntimeProvider[] = ['hermes', 'openclaw', 'openai', 'custom'];
const bridgeActiveStatuses: AgentConnectorStatus[] = ['connected', 'available'];
const validConnectionStates = ['online', 'degraded', 'offline', 'reconnecting'];
const validAgentStatuses = ['available', 'working', 'waiting', 'limited'];
const validAgentProfiles = ['home-operator', 'support-diagnostics', 'security-watch', 'guest-readonly'];
const validAgentSpecialties = ['coordinator', 'support', 'security', 'home', 'workflow'];
const bridgeVisibleRoleAliases: Record<string, 'admin' | 'support' | 'home' | null> = {
  admin: 'admin',
  support: 'support',
  home: 'home',
  member: 'home',
  guest: null,
};
const validJobStatuses = ['active', 'paused', 'failed', 'completed'];
const validJobKinds = ['cron', 'monitor', 'automation'];
const validPermissionLevels = ['read', 'suggest', 'execute', 'blocked'];
const validPermissionRisks = ['low', 'medium', 'high'];
const validPermissionCategories = ['files', 'workspace', 'integrations', 'commands', 'network', 'automation'];
const validActivityKinds = ['proposal', 'approval', 'execution', 'failure', 'connection'];
const diagnosticLimit = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getBridgePath(baseUrl: string, path: 'status' | 'events' | 'tasks') {
  return `${baseUrl.replace(/\/+$/u, '')}/${path}`;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function summarizePayload(value: unknown) {
  try {
    const text = JSON.stringify(value);
    if (!text) return undefined;
    return text.length > 220 ? `${text.slice(0, 217)}...` : text;
  } catch {
    return String(value).slice(0, 220);
  }
}

export function createAgentBridgeDiagnostic({
  connectorId,
  level,
  message,
  source,
  timestamp = new Date().toISOString(),
  payload,
}: {
  connectorId: string;
  level: AgentBridgeDiagnosticLevel;
  message: string;
  source: AgentBridgeDiagnosticSource;
  timestamp?: string;
  payload?: unknown;
}): AgentBridgeDiagnostic {
  return {
    id: `bridge-diagnostic-${connectorId}-${source}-${Date.parse(timestamp) || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    connectorId,
    level,
    message,
    source,
    timestamp,
    payloadSummary: payload === undefined ? undefined : summarizePayload(payload),
  };
}

export function appendAgentBridgeDiagnostic(state: AgentControlState, diagnostic: AgentBridgeDiagnostic): AgentControlState {
  return {
    ...state,
    diagnostics: [diagnostic, ...(state.diagnostics ?? [])].slice(0, diagnosticLimit),
    version: state.version + 1,
    updatedAt: diagnostic.timestamp,
  };
}

function normalizeConnectorStatus(value: unknown, fallback: AgentConnectorStatus): AgentConnectorStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['ok', 'up', 'ready', 'healthy', 'online'].includes(normalized)) return 'connected';
    if (['down', 'offline', 'unreachable', 'not-listening', 'not_listening'].includes(normalized)) return 'offline';
    if (['upstream_error', 'auth_failed', 'error'].includes(normalized)) return 'error';
  }
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

function normalizeVisibleRoles(value: unknown) {
  if (!Array.isArray(value)) return null;
  const roles = value
    .map((item) => (typeof item === 'string' ? bridgeVisibleRoleAliases[item] : null))
    .filter((item): item is 'admin' | 'support' | 'home' => item !== null);

  return [...new Set(roles)];
}

function hasBridgeVisibleRoles(value: unknown) {
  const roles = normalizeVisibleRoles(value);
  return Boolean(roles?.length);
}

function normalizeAgentActivityList(value: unknown): AgentActivity[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !validActivityKinds.includes(item.kind as string) ||
      typeof item.title !== 'string' ||
      typeof item.detail !== 'string' ||
      typeof item.timestamp !== 'string' ||
      typeof item.source !== 'string'
    ) {
      return null;
    }

    const visibleTo = normalizeVisibleRoles(item.visibleTo);
    if (!visibleTo?.length) return null;

    return {
      ...item,
      visibleTo,
    } as AgentActivity;
  });

  return normalized.every(Boolean) ? (normalized as AgentActivity[]) : null;
}

function normalizeAgentDescriptorList(value: unknown): AgentDescriptor[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      !validAgentSpecialties.includes(item.specialty as string) ||
      typeof item.provider !== 'string' ||
      typeof item.model !== 'string' ||
      !validAgentProfiles.includes(item.profile as string) ||
      !validAgentStatuses.includes(item.status as string) ||
      !validConnectionStates.includes(item.connection as string) ||
      typeof item.summary !== 'string'
    ) {
      return null;
    }

    const visibleTo = normalizeVisibleRoles(item.visibleTo);
    if (!visibleTo?.length) return null;

    return {
      ...item,
      visibleTo,
    } as AgentDescriptor;
  });

  return normalized.every(Boolean) ? (normalized as AgentDescriptor[]) : null;
}

function normalizeAgentJobList(value: unknown): AgentScheduledJob[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      !validJobKinds.includes(item.kind as string) ||
      !validJobStatuses.includes(item.status as string) ||
      typeof item.cadence !== 'string' ||
      typeof item.lastRunAt !== 'string' ||
      typeof item.nextRunAt !== 'string' ||
      typeof item.owner !== 'string' ||
      typeof item.safeForHome !== 'boolean' ||
      typeof item.description !== 'string'
    ) {
      return null;
    }

    const visibleTo = normalizeVisibleRoles(item.visibleTo);
    if (!visibleTo?.length) return null;

    return {
      ...item,
      visibleTo,
    } as AgentScheduledJob;
  });

  return normalized.every(Boolean) ? (normalized as AgentScheduledJob[]) : null;
}

function normalizeAgentPermissionList(value: unknown): AgentPermission[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.label !== 'string' ||
      !validPermissionCategories.includes(item.category as string) ||
      !validPermissionLevels.includes(item.level as string) ||
      !validPermissionRisks.includes(item.risk as string) ||
      typeof item.description !== 'string'
    ) {
      return null;
    }

    const visibleTo = normalizeVisibleRoles(item.visibleTo);
    if (!visibleTo?.length) return null;

    return {
      ...item,
      visibleTo,
    } as AgentPermission;
  });

  return normalized.every(Boolean) ? (normalized as AgentPermission[]) : null;
}

function normalizeLooseProvider(value: unknown, fallback: AgentRuntimeProvider): AgentRuntimeProvider {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('hermes')) return 'hermes';
  if (normalized.includes('openclaw')) return 'openclaw';
  if (normalized.includes('openai')) return 'openai';
  return normalizeProvider(normalized, fallback);
}

function normalizeLooseRoleList(value: unknown): AgentDescriptor['visibleTo'] {
  const roles = normalizeVisibleRoles(Array.isArray(value) ? value : typeof value === 'string' ? [value] : ['admin', 'support', 'home']);
  return roles?.length ? roles : ['admin', 'support', 'home'];
}

function normalizeLooseAgentSpecialty(value: unknown): AgentDescriptor['specialty'] {
  if (typeof value !== 'string') return 'coordinator';
  const normalized = value.trim().toLowerCase();
  if (validAgentSpecialties.includes(normalized)) return normalized as AgentDescriptor['specialty'];
  if (normalized.includes('security')) return 'security';
  if (normalized.includes('member')) return 'home';
  if (normalized.includes('home')) return 'home';
  if (normalized.includes('workflow')) return 'workflow';
  if (normalized.includes('support')) return 'support';
  return 'coordinator';
}

function normalizeLooseAgentProfile(value: unknown, roles: AgentDescriptor['visibleTo']): AgentDescriptor['profile'] {
  if (typeof value === 'string' && validAgentProfiles.includes(value)) return value as AgentDescriptor['profile'];
  if (roles.includes('support')) return 'support-diagnostics';
  if (roles.includes('home')) return 'home-operator';
  return 'guest-readonly';
}

function normalizeLooseAgentStatus(value: unknown, connectorStatus: AgentConnectorStatus): AgentDescriptor['status'] {
  if (typeof value === 'string' && validAgentStatuses.includes(value)) return value as AgentDescriptor['status'];
  if (connectorStatus === 'connected' || connectorStatus === 'available') return 'available';
  if (connectorStatus === 'error') return 'limited';
  return 'waiting';
}

function normalizeLooseAgentConnection(value: unknown, connectorStatus: AgentConnectorStatus): AgentDescriptor['connection'] {
  if (typeof value === 'string' && validConnectionStates.includes(value)) return value as AgentDescriptor['connection'];
  if (connectorStatus === 'connected') return 'online';
  if (connectorStatus === 'available') return 'reconnecting';
  return 'offline';
}

function normalizeLooseAgentDescriptorList(
  value: unknown,
  provider: AgentRuntimeProvider,
  activeEngine: string | null,
  connectorStatus: AgentConnectorStatus,
): AgentDescriptor[] | null {
  const strict = normalizeAgentDescriptorList(value);
  if (strict) return strict;

  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((item, index): AgentDescriptor | null => {
      if (!isRecord(item)) return null;
      const id = getString(item.id) ?? getString(item.agentId) ?? getString(item.name)?.toLowerCase().replace(/[^a-z0-9]+/giu, '-') ?? `${provider}-agent-${index + 1}`;
      const roles = normalizeLooseRoleList(item.visibleTo ?? item.roles ?? item.role);
      const name = getString(item.name) ?? getString(item.label) ?? `${provider} agent ${index + 1}`;
      const model = getString(item.model) ?? getString(item.engine) ?? activeEngine ?? `${provider}-agent`;

      return {
        id,
        name,
        specialty: normalizeLooseAgentSpecialty(item.specialty ?? item.role ?? item.profile),
        provider,
        model,
        profile: normalizeLooseAgentProfile(item.profile, roles),
        status: normalizeLooseAgentStatus(item.status, connectorStatus),
        connection: normalizeLooseAgentConnection(item.connection, connectorStatus),
        summary: getString(item.summary) ?? getString(item.description) ?? `External ${provider} agent reported by the bridge.`,
        visibleTo: roles,
      } satisfies AgentDescriptor;
    })
    .filter((item): item is AgentDescriptor => item !== null);

  return normalized.length ? normalized : null;
}

function normalizeLooseActivityList(value: unknown, provider: AgentRuntimeProvider, status: AgentConnectorStatus): AgentActivity[] | null {
  const strict = normalizeAgentActivityList(value);
  if (strict) return strict;

  if (Array.isArray(value)) {
  const normalized = value
      .map((item, index): AgentActivity | null => {
        if (!isRecord(item)) return null;
        const visibleTo = normalizeLooseRoleList(item.visibleTo ?? item.roles ?? item.role);
        const kind = typeof item.kind === 'string' && validActivityKinds.includes(item.kind) ? item.kind as AgentActivity['kind'] : 'connection';
        return {
          id: getString(item.id) ?? `${provider}-activity-${index + 1}`,
          kind,
          title: getString(item.title) ?? getString(item.message) ?? `${provider} bridge update`,
          detail: getString(item.detail) ?? getString(item.message) ?? `Bridge reported ${status}.`,
          timestamp: getString(item.timestamp) ?? getString(item.time) ?? new Date().toISOString(),
          source: getString(item.source) ?? provider,
          status: typeof item.status === 'string' ? item.status as AgentActivity['status'] : undefined,
          visibleTo,
        } satisfies AgentActivity;
      })
      .filter((item): item is AgentActivity => item !== null);

    return normalized.length ? normalized : null;
  }

  return null;
}

function isAgentActivityList(value: unknown): value is AgentActivity[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        validActivityKinds.includes(item.kind as string) &&
        typeof item.title === 'string' &&
        typeof item.detail === 'string' &&
        typeof item.timestamp === 'string' &&
        typeof item.source === 'string' &&
        hasBridgeVisibleRoles(item.visibleTo),
    )
  );
}

function isAgentDescriptorList(value: unknown): value is AgentDescriptor[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        validAgentSpecialties.includes(item.specialty as string) &&
        typeof item.provider === 'string' &&
        typeof item.model === 'string' &&
        validAgentProfiles.includes(item.profile as string) &&
        validAgentStatuses.includes(item.status as string) &&
        validConnectionStates.includes(item.connection as string) &&
        typeof item.summary === 'string' &&
        hasBridgeVisibleRoles(item.visibleTo),
    )
  );
}

function isAgentJobList(value: unknown): value is AgentScheduledJob[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        validJobKinds.includes(item.kind as string) &&
        validJobStatuses.includes(item.status as string) &&
        typeof item.cadence === 'string' &&
        typeof item.lastRunAt === 'string' &&
        typeof item.nextRunAt === 'string' &&
        typeof item.owner === 'string' &&
        typeof item.safeForHome === 'boolean' &&
        typeof item.description === 'string' &&
        hasBridgeVisibleRoles(item.visibleTo),
    )
  );
}

function isAgentPermissionList(value: unknown): value is AgentPermission[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.label === 'string' &&
        validPermissionCategories.includes(item.category as string) &&
        validPermissionLevels.includes(item.level as string) &&
        validPermissionRisks.includes(item.risk as string) &&
        typeof item.description === 'string' &&
        hasBridgeVisibleRoles(item.visibleTo),
    )
  );
}

function isAgentUsageSummary(value: unknown): value is AgentUsageSummary {
  return (
    isRecord(value) &&
    getNumber(value.requestCount) !== null &&
    getNumber(value.approvedActionCount) !== null &&
    getNumber(value.rejectedActionCount) !== null &&
    getNumber(value.blockedActionCount) !== null &&
    getNumber(value.estimatedTokens) !== null &&
    getNumber(value.estimatedCostUsd) !== null &&
    typeof value.windowStartedAt === 'string'
  );
}

function isStrictAgentBridgeStatusResponse(value: unknown): value is AgentBridgeStatusResponse {
  if (!isRecord(value)) return false;
  if (
    value.status !== undefined &&
    !validConnectorStatuses.includes(value.status as AgentConnectorStatus) &&
    !validBridgeStatusAliases.includes(value.status as string)
  ) {
    return false;
  }
  if (value.provider !== undefined && !validProviders.includes(value.provider as AgentRuntimeProvider)) return false;
  if (value.activeEngine !== undefined && value.activeEngine !== null && typeof value.activeEngine !== 'string') return false;
  if (value.activeAgentId !== undefined && value.activeAgentId !== null && typeof value.activeAgentId !== 'string') return false;
  if (value.currentTask !== undefined && value.currentTask !== null && typeof value.currentTask !== 'string') return false;
  if (value.capabilities !== undefined && !isStringArray(value.capabilities)) return false;
  if (value.lastSeenAt !== undefined && value.lastSeenAt !== null && typeof value.lastSeenAt !== 'string') return false;
  if (value.agents !== undefined && !isAgentDescriptorList(value.agents)) return false;
  if (value.jobs !== undefined && !isAgentJobList(value.jobs)) return false;
  if (value.permissions !== undefined && !isAgentPermissionList(value.permissions)) return false;
  if (value.activity !== undefined && !isAgentActivityList(value.activity)) return false;
  if (value.usage !== undefined && !isAgentUsageSummary(value.usage)) return false;
  if (value.missionControlEvents !== undefined && !isMissionControlEventList(value.missionControlEvents)) return false;
  return true;
}

export function normalizeAgentBridgeStatusResponse(value: unknown): AgentBridgeStatusResponse | null {
  if (!isRecord(value)) return null;
  const statusKeys = [
    'status',
    'state',
    'ok',
    'provider',
    'runtimeProvider',
    'engineProvider',
    'activeEngine',
    'engine',
    'model',
    'activeModel',
    'currentTask',
    'task',
    'message',
    'agents',
    'agentRecords',
    'availableAgents',
    'activity',
    'activities',
    'capabilities',
    'lastSeenAt',
    'missionControlEvents',
    'events',
  ];
  if (!statusKeys.some((key) => key in value)) return null;

  if (isStrictAgentBridgeStatusResponse(value)) {
    return {
      ...value,
      status: normalizeConnectorStatus(value.status, 'connected'),
      provider: normalizeLooseProvider(value.provider, 'custom'),
      missionControlEvents: normalizeBridgeMissionEvents(value.missionControlEvents),
    };
  }

  const rawStatus = value.status ?? value.state ?? (value.ok === true ? 'ok' : undefined);
  const status = normalizeConnectorStatus(rawStatus, 'connected');
  const provider = normalizeLooseProvider(value.provider ?? value.runtimeProvider ?? value.engineProvider, 'custom');
  const activeEngine =
    getString(value.activeEngine) ??
    getString(value.engine) ??
    getString(value.model) ??
    getString(value.activeModel) ??
    getString(value.modelName) ??
    null;
  const agents = normalizeLooseAgentDescriptorList(value.agents ?? value.agentRecords ?? value.availableAgents, provider, activeEngine, status);
  const jobs = normalizeAgentJobList(value.jobs);
  const permissions = normalizeAgentPermissionList(value.permissions);
  const activity = normalizeLooseActivityList(value.activity ?? value.activities, provider, status);
  const usage = isAgentUsageSummary(value.usage) ? value.usage : undefined;
  const capabilities = isStringArray(value.capabilities) ? value.capabilities : undefined;
  const missionControlEvents = normalizeBridgeMissionEvents(value.missionControlEvents ?? value.events);

  const normalized: AgentBridgeStatusResponse = {
    status,
    provider,
    activeEngine,
    activeAgentId: getString(value.activeAgentId) ?? getString(value.agentId) ?? agents?.[0]?.id ?? null,
    currentTask: getString(value.currentTask) ?? getString(value.task) ?? getString(value.message) ?? null,
    agents: agents ?? undefined,
    jobs: jobs ?? undefined,
    permissions: permissions ?? undefined,
    usage,
    activity: activity ?? undefined,
    capabilities,
    lastSeenAt: getString(value.lastSeenAt) ?? getString(value.timestamp) ?? new Date().toISOString(),
    missionControlEvents,
  };

  return isStrictAgentBridgeStatusResponse(normalized) ? normalized : null;
}

export function isAgentBridgeStatusResponse(value: unknown): value is AgentBridgeStatusResponse {
  return normalizeAgentBridgeStatusResponse(value) !== null;
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

  const statusPayload = normalizeAgentBridgeStatusResponse(payload.status);
  if (payload.type === 'status' && statusPayload) {
    return { type: 'status', status: statusPayload };
  }

  const activity = normalizeAgentActivityList(payload.activity);
  if (payload.type === 'activity' && activity) {
    return { type: 'activity', activity };
  }

  const directStatusPayload = normalizeAgentBridgeStatusResponse(payload);
  if (directStatusPayload && (payload.status || payload.provider || payload.activeEngine || payload.currentTask || payload.ok)) {
    return { type: 'status', status: directStatusPayload };
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
    .sort((left, right) => connectorPriority(left) - connectorPriority(right) || statusPriority(left) - statusPriority(right));

  const reachableInactiveConnectors = state.connectors
    .filter(
      (connector) =>
        connector.kind !== 'mock' &&
        Boolean(connector.url) &&
        Boolean(connector.healthCheckedAt || connector.lastSeenAt) &&
        !connector.error,
    )
    .sort((left, right) => connectorPriority(left) - connectorPriority(right) || statusPriority(left) - statusPriority(right));

  return activeConnectors[0] ?? reachableInactiveConnectors[0] ?? state.connectors.find((connector) => connector.kind === 'mock') ?? state.connectors[0];
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
    eventStreamStatus: 'connected',
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

  const agents = normalizeAgentDescriptorList(response.agents);
  if (agents) {
    statePatch.agents = agents;
  }

  const jobs = normalizeAgentJobList(response.jobs);
  if (jobs) {
    statePatch.jobs = jobs;
  }

  const permissions = normalizeAgentPermissionList(response.permissions);
  if (permissions) {
    statePatch.permissions = permissions;
  }

  if (isAgentUsageSummary(response.usage)) {
    statePatch.usage = response.usage;
  }

  const activity = normalizeAgentActivityList(response.activity);
  if (activity) {
    statePatch.activity = activity;
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
  source: AgentBridgeDiagnosticSource = 'runtime',
  payload?: unknown,
): AgentControlState {
  const timestamp = new Date().toISOString();
  const connectors = replaceConnector(state, connectorId, {
    status,
    healthCheckedAt: timestamp,
    error,
  });

  return getUpdatedState(state, connectors, {
    eventStreamStatus: status === 'error' ? 'error' : state.eventStreamStatus,
    diagnostics: [
      createAgentBridgeDiagnostic({
        connectorId,
        level: status === 'error' ? 'error' : 'warning',
        message: error,
        source,
        timestamp,
        payload,
      }),
      ...(state.diagnostics ?? []),
    ].slice(0, diagnosticLimit),
  });
}

export function applyAgentBridgeEvent(
  state: AgentControlState,
  connectorId: string,
  event: AgentBridgeEvent,
  receivedAt = new Date().toISOString(),
): { state: AgentControlState; missionControlEvents: MissionControlEvent[] } {
  if (event.type === 'mission-events') {
    return {
      state: {
        ...state,
        eventStreamStatus: 'connected',
        lastBridgeEventAt: receivedAt,
        version: state.version + 1,
        updatedAt: receivedAt,
      },
      missionControlEvents: event.events,
    };
  }

  if (event.type === 'status') {
    const applied = applyAgentBridgeStatus(state, connectorId, event.status, receivedAt);
    return {
      ...applied,
      state: {
        ...applied.state,
        eventStreamStatus: 'connected',
        lastBridgeEventAt: receivedAt,
      },
    };
  }

  return {
    state: {
      ...state,
      activity: [...event.activity, ...state.activity].slice(0, 40),
      eventStreamStatus: 'connected',
      lastBridgeEventAt: receivedAt,
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
      const normalized = normalizeAgentBridgeStatusResponse(body);
      if (!normalized) {
        throw new Error('Agent bridge status returned an invalid payload.');
      }

      return normalized;
    },
    connectEvents(onEvent, onError) {
      const source = eventSourceFactory(getBridgePath(connector.url as string, 'events'));

      source.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          const bridgeEvent = normalizeAgentBridgeEvent(parsed);
          if (!bridgeEvent) {
            onError?.(new Error('Agent bridge SSE event returned an invalid payload.'));
            return;
          }
          onEvent(bridgeEvent);
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
