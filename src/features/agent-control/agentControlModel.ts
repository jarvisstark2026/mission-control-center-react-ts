import type { ShellRole } from '../shell/roles';
import type { CommandAuditEntry, CommandRequest } from '../mission-control';
import { mockAgentControlState } from './agentControlMock';
import type {
  AgentActivity,
  AgentConnectorRecord,
  AgentControlState,
  AgentDescriptor,
  AgentJobStatus,
  AgentPermission,
  AgentScheduledJob,
  AgentConnectorStatus,
  AgentVisibleRole,
} from './agentControlTypes';

export type AgentJobSummary = {
  total: number;
  active: number;
  paused: number;
  failed: number;
  completed: number;
  nextRunAt: string | null;
};

const editableAgentRoles: ShellRole[] = ['admin'];

export type AgentConnectorRuntimeOptions = {
  localBridgeUrl?: string | null;
  remoteApiUrl?: string | null;
  now?: string;
};

export const defaultAgentLocalBridgeUrl = 'http://127.0.0.1:8787';

function isVisibleRole(role: ShellRole): role is AgentVisibleRole {
  return role !== 'guest';
}

function canSeeRecord(role: ShellRole, visibleTo: AgentVisibleRole[]) {
  return isVisibleRole(role) && visibleTo.includes(role);
}

function getCommandActivityKind(type: CommandAuditEntry['type']): AgentActivity['kind'] {
  if (type === 'failed') return 'failure';
  if (type === 'approved' || type === 'overridden') return 'approval';
  if (type === 'queued' || type === 'running' || type === 'succeeded') return 'execution';
  return 'proposal';
}

function getCommandActivityStatus(type: CommandAuditEntry['type']): AgentActivity['status'] {
  return type === 'proposed' ? 'sent' : type;
}

function normalizeConnectorStatus(url: string | null, fallbackStatus: AgentConnectorStatus) {
  if (!url) return 'not-configured';
  if (fallbackStatus === 'connected' || fallbackStatus === 'error') return fallbackStatus;
  return 'available';
}

function createAgentConnectors(options: AgentConnectorRuntimeOptions = {}): AgentConnectorRecord[] {
  const localBridgeUrl = options.localBridgeUrl || defaultAgentLocalBridgeUrl;
  const remoteApiUrl = options.remoteApiUrl || null;

  return mockAgentControlState.connectors.map((connector) => {
    if (connector.id === 'hermes-local-bridge') {
      return {
        ...connector,
        url: localBridgeUrl,
        status: normalizeConnectorStatus(localBridgeUrl, connector.status),
        healthCheckedAt: null,
        activeEngine: null,
        sourcePriority: 1,
        capabilities: [...connector.capabilities],
      };
    }

    if (connector.id === 'openclaw-local-bridge') {
      return {
        ...connector,
        status: connector.status,
        healthCheckedAt: null,
        activeEngine: null,
        sourcePriority: 2,
        capabilities: [...connector.capabilities],
      };
    }

    if (connector.id === 'agent-remote-bridge') {
      return {
        ...connector,
        url: remoteApiUrl,
        status: normalizeConnectorStatus(remoteApiUrl, connector.status),
        healthCheckedAt: null,
        activeEngine: null,
        sourcePriority: 3,
        capabilities: [...connector.capabilities],
        error: remoteApiUrl ? null : connector.error,
      };
    }

    return {
      ...connector,
      healthCheckedAt: connector.healthCheckedAt ?? null,
      activeEngine: connector.activeEngine ?? null,
      sourcePriority: connector.sourcePriority ?? 99,
      capabilities: [...connector.capabilities],
    };
  });
}

function getActiveConnectorId(connectors: AgentConnectorRecord[]) {
  const connectedConnector = connectors.find((connector) => connector.kind === 'local' && connector.status === 'connected');
  const availableLocalConnector = connectors.find((connector) => connector.kind === 'local' && connector.status === 'available');
  const remoteConnector = connectors.find(
    (connector) => connector.kind === 'remote' && (connector.status === 'connected' || connector.status === 'available'),
  );
  const mockConnector = connectors.find((connector) => connector.kind === 'mock');

  return connectedConnector?.id ?? availableLocalConnector?.id ?? remoteConnector?.id ?? mockConnector?.id ?? connectors[0]?.id ?? '';
}

export function createInitialAgentControlState(options: AgentConnectorRuntimeOptions = {}): AgentControlState {
  const connectors = createAgentConnectors(options);

  return {
    ...mockAgentControlState,
    identity: { ...mockAgentControlState.identity },
    agents: mockAgentControlState.agents.map((agent) => ({ ...agent, visibleTo: [...agent.visibleTo] })),
    connectors,
    activeConnectorId: getActiveConnectorId(connectors),
    usage: { ...mockAgentControlState.usage },
    jobs: mockAgentControlState.jobs.map((job) => ({ ...job, visibleTo: [...job.visibleTo] })),
    permissions: mockAgentControlState.permissions.map((permission) => ({
      ...permission,
      visibleTo: [...permission.visibleTo],
    })),
    activity: mockAgentControlState.activity.map((activity) => ({ ...activity, visibleTo: [...activity.visibleTo] })),
  };
}

export function getAgentConnectors(state: AgentControlState) {
  return state.connectors.map((connector) => ({ ...connector, capabilities: [...connector.capabilities] }));
}

export function getActiveAgentConnector(state: AgentControlState): AgentConnectorRecord {
  return (
    state.connectors.find((connector) => connector.id === state.activeConnectorId) ??
    state.connectors.find((connector) => connector.kind === 'mock') ??
    state.connectors[0]
  );
}

export function getAgentConnectorSummary(state: AgentControlState) {
  const connectors = state.connectors;
  return {
    total: connectors.length,
    connected: connectors.filter((connector) => connector.status === 'connected').length,
    available: connectors.filter((connector) => connector.status === 'available').length,
    offline: connectors.filter((connector) => connector.status === 'offline' || connector.status === 'error').length,
    configured: connectors.filter((connector) => connector.status !== 'not-configured').length,
  };
}

export function canViewAgentControl(role: ShellRole) {
  return role !== 'guest';
}

export function canEditAgentSettings(role: ShellRole) {
  return editableAgentRoles.includes(role);
}

export function getVisibleAgentJobs(state: AgentControlState, role: ShellRole): AgentScheduledJob[] {
  if (!canViewAgentControl(role)) return [];
  return state.jobs.filter((job) => canSeeRecord(role, job.visibleTo));
}

export function getVisibleAgentPermissions(state: AgentControlState, role: ShellRole): AgentPermission[] {
  if (!canViewAgentControl(role)) return [];
  return state.permissions.filter((permission) => canSeeRecord(role, permission.visibleTo));
}

export function getVisibleAgentActivity(state: AgentControlState, role: ShellRole): AgentActivity[] {
  if (!canViewAgentControl(role)) return [];
  return state.activity.filter((activity) => canSeeRecord(role, activity.visibleTo));
}

export function getVisibleAgentDescriptors(state: AgentControlState, role: ShellRole): AgentDescriptor[] {
  if (!canViewAgentControl(role)) return [];
  return state.agents.filter((agent) => canSeeRecord(role, agent.visibleTo));
}

export function getAgentDescriptorById(state: AgentControlState, agentId: string): AgentDescriptor {
  const agent = state.agents.find((item) => item.id === agentId) ?? state.agents.find((item) => item.id === state.activeAgentId);
  if (agent) return agent;
  return {
    id: state.identity.id,
    name: state.identity.name,
    specialty: 'coordinator',
    provider: state.identity.provider,
    model: state.identity.model,
    profile: state.identity.profile,
    status: state.identity.status,
    connection: state.identity.connection,
    summary: state.identity.currentTask,
    visibleTo: ['admin', 'support', 'home'],
  };
}

export function getCommandAuditAgentActivity(commands: CommandRequest[], role: ShellRole): AgentActivity[] {
  if (!canViewAgentControl(role) || !isVisibleRole(role)) return [];

  return commands
    .flatMap((command) =>
      command.auditTrail.map((entry) => ({
        id: `${command.id}-${entry.id}`,
        kind: getCommandActivityKind(entry.type),
        title: command.title,
        detail: entry.detail,
        timestamp: entry.timestamp,
        source: command.agent.agentName,
        status: getCommandActivityStatus(entry.type),
        visibleTo: ['admin', 'support', 'home'] as AgentVisibleRole[],
      })),
    )
    .filter((activity) => canSeeRecord(role, activity.visibleTo))
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

function countJobsByStatus(jobs: AgentScheduledJob[], status: AgentJobStatus) {
  return jobs.filter((job) => job.status === status).length;
}

function getNextRunAt(jobs: AgentScheduledJob[]) {
  const next = jobs
    .map((job) => Date.parse(job.nextRunAt))
    .filter((time) => Number.isFinite(time))
    .sort((left, right) => left - right)[0];

  return typeof next === 'number' ? new Date(next).toISOString() : null;
}

export function getAgentJobSummary(jobs: AgentScheduledJob[]): AgentJobSummary {
  return {
    total: jobs.length,
    active: countJobsByStatus(jobs, 'active'),
    paused: countJobsByStatus(jobs, 'paused'),
    failed: countJobsByStatus(jobs, 'failed'),
    completed: countJobsByStatus(jobs, 'completed'),
    nextRunAt: getNextRunAt(jobs),
  };
}

export function getAgentUsageApprovalRate(state: AgentControlState) {
  const totalDecisions = state.usage.approvedActionCount + state.usage.rejectedActionCount + state.usage.blockedActionCount;
  if (totalDecisions === 0) return 0;
  return Math.round((state.usage.approvedActionCount / totalDecisions) * 100);
}
