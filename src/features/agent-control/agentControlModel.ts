import type { ShellRole } from '../shell/roles';
import type { CommandAuditEntry, CommandRequest } from '../mission-control';
import type { MissionControlEvent } from '../mission-control';
import { mockAgentControlState } from './agentControlMock';
import type {
  AgentActivity,
  AgentConnectorRecord,
  AgentControlState,
  AgentDescriptor,
  AgentBridgeTutorialStep,
  AgentBridgeTutorialStepStatus,
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

export type AgentBridgeTutorialSettings = {
  localBridgeUrl?: string | null;
  remoteApiUrl?: string | null;
};

export type AgentControlProposalInput = {
  agentId: string;
  agentName: string;
  profile: string;
  title: string;
  summary: string;
  reasoning: string;
  expectedResult: string;
  actor: string;
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
    diagnostics: mockAgentControlState.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    eventStreamStatus: mockAgentControlState.eventStreamStatus,
    lastBridgeEventAt: mockAgentControlState.lastBridgeEventAt,
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

function hasBridgeFailure(state: AgentControlState, sources: Array<'status' | 'runtime' | 'tasks'>) {
  const activeConnector = getActiveAgentConnector(state);

  return (
    (activeConnector.kind !== 'mock' && (activeConnector.status === 'offline' || activeConnector.status === 'error')) ||
    state.diagnostics.some((diagnostic) => sources.includes(diagnostic.source as 'status' | 'runtime' | 'tasks') && diagnostic.level !== 'info')
  );
}

function getStepStatus(pass: boolean, failed: boolean): AgentBridgeTutorialStepStatus {
  if (pass) return 'pass';
  if (failed) return 'failed';
  return 'waiting';
}

export function getAgentBridgeReachableUrl(state: AgentControlState) {
  const checkedConnector = state.connectors.find(
    (connector) =>
      connector.kind !== 'mock' &&
      connector.url &&
      Boolean(connector.healthCheckedAt || connector.lastSeenAt) &&
      !connector.error,
  );
  return checkedConnector?.url ?? null;
}

export function getAgentBridgeTutorialSteps(
  state: AgentControlState,
  settings: AgentBridgeTutorialSettings = {},
): AgentBridgeTutorialStep[] {
  const reachableUrl = getAgentBridgeReachableUrl(state);
  const configuredEndpoint = Boolean(settings.localBridgeUrl?.trim());
  const taskFailure = state.diagnostics.some((diagnostic) => diagnostic.source === 'tasks' && diagnostic.level !== 'info');
  const taskEvidence = state.usage.requestCount > 0 || state.activity.some((activity) => activity.kind === 'proposal') || Boolean(state.lastBridgeEventAt);
  const bridgeFailed = hasBridgeFailure(state, ['status', 'runtime']);

  return [
    {
      id: 'bridge-running',
      title: 'Local bridge running',
      body: 'In the Windows desktop app, choose Same PC, LAN PC, or Tailscale, then start the local Mission Control bridge.',
      status: getStepStatus(Boolean(reachableUrl), bridgeFailed),
      command: 'Agent Control -> Bridge setup -> Start bridge',
    },
    {
      id: 'port-reachable',
      title: 'Local /status reachable',
      body: 'Mission Control must be able to read http://127.0.0.1:8787/status before tasks can be sent.',
      status: getStepStatus(Boolean(reachableUrl), bridgeFailed),
      command: 'Open http://127.0.0.1:8787/status',
    },
    {
      id: 'endpoint-saved',
      title: 'Connection mode saved',
      body: 'Save the selected mode and Hermes host so the desktop bridge knows where to forward tasks.',
      status: getStepStatus(configuredEndpoint, false),
    },
    {
      id: 'task-proposal-tested',
      title: 'Task proposal tested',
      body: 'Send one task from Agent proposals and confirm the proposal appears in Command Inbox.',
      status: getStepStatus(taskEvidence, taskFailure),
    },
  ];
}

export function canViewAgentControl(role: ShellRole) {
  return role !== 'guest';
}

export function canEditAgentSettings(role: ShellRole) {
  return editableAgentRoles.includes(role);
}

function createAgentControlCommandProposal(input: AgentControlProposalInput): MissionControlEvent[] {
  const timestamp = new Date().toISOString();
  const commandId = `agent-control-${input.agentId}-${Date.now().toString(36)}`;

  return [
    {
      type: 'command',
      command: {
        id: commandId,
        title: input.title,
        summary: input.summary,
        source: 'agent-control',
        agent: {
          agentId: input.agentId,
          agentName: input.agentName,
          profile: input.profile,
        },
        reasoning: input.reasoning,
        expectedResult: input.expectedResult,
        scope: 'system',
        risk: 'elevated',
        status: 'pending',
        requestedAt: timestamp,
        execution: {
          status: 'not-started',
          result: 'Waiting in Command Inbox for human approval.',
          rollbackAvailable: true,
        },
        auditTrail: [
          {
            id: `audit-${commandId}-proposed`,
            type: 'proposed',
            actor: input.actor,
            timestamp,
            detail: `${input.actor} requested "${input.title}" from Agent Control.`,
          },
        ],
      },
    },
    {
      type: 'notification',
      notification: {
        id: `notification-${commandId}`,
        level: 'warning',
        title: 'Agent Control proposal ready',
        body: `Command Inbox is holding "${input.title}" for approval.`,
        source: 'agent-control',
        timestamp,
        acknowledged: false,
        relatedCommandId: commandId,
      },
    },
  ];
}

export function createAgentPermissionChangeProposal(agent: AgentDescriptor, permission: AgentPermission): MissionControlEvent[] {
  return createAgentControlCommandProposal({
    agentId: agent.id,
    agentName: agent.name,
    profile: agent.profile,
    title: `Review ${permission.label} permission`,
    summary: `Review requested changes for ${permission.category} permission "${permission.label}" on ${agent.name}.`,
    reasoning: `Agent Control treats permission changes as gated proposals because runtime enforcement belongs behind Command Inbox approval.`,
    expectedResult: `No backend permission changes occur until an allowed role approves the proposal.`,
    actor: 'agent-control',
  });
}

export function createAgentProfileChangeProposal(agent: AgentDescriptor): MissionControlEvent[] {
  return createAgentControlCommandProposal({
    agentId: agent.id,
    agentName: agent.name,
    profile: agent.profile,
    title: `Review ${agent.name} profile`,
    summary: `Review the active profile and default routing for ${agent.name}.`,
    reasoning: `Agent Control keeps profile edits local/proposed until a backend enforcement layer is connected.`,
    expectedResult: `Command Inbox records the requested profile review and keeps execution gated.`,
    actor: 'agent-control',
  });
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
