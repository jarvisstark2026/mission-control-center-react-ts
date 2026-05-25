import { normalizeMissionControlEventList, type CommandRisk, type MissionControlEvent } from '../mission-control';
import { createInitialAgentControlState, getAgentDescriptorById } from '../agent-control/agentControlModel';
import type {
  AgentTaskGatewayMode,
  AgentTaskGatewayResult,
  AgentTaskMessage,
  AgentTaskProposal,
  AgentTaskRequest,
} from './agentTaskingTypes';

export type AgentTaskGateway = {
  mode: AgentTaskGatewayMode;
  submitTask: (request: AgentTaskRequest) => Promise<AgentTaskGatewayResult>;
};

type AgentTaskGatewayOptions = {
  delayMs?: number;
};

type AgentTaskFetchGatewayOptions = {
  fetchImpl?: typeof fetch;
};

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function createSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 28) || 'task';
}

function getCommandRisk(request: AgentTaskRequest): CommandRisk {
  if (request.role === 'admin') return request.risk;
  if (request.scope === 'household') return 'safe';
  return request.risk === 'critical' ? 'elevated' : request.risk;
}

function createMockTaskResult(request: AgentTaskRequest): AgentTaskGatewayResult {
  const timestamp = new Date().toISOString();
  const slug = createSlug(request.objective);
  const commandId = `agent-task-${slug}-${Date.parse(request.requestedAt) || Date.now()}`;
  const risk = getCommandRisk(request);
  const title = request.objective.length > 52 ? `${request.objective.slice(0, 49).trim()}...` : request.objective;
  const agent = getAgentDescriptorById(createInitialAgentControlState(), request.targetAgentId);
  const reasoning = `${agent.name} mapped the objective to a ${request.scope} proposal and staged it for human approval.`;
  const expectedResult = `Command Inbox receives a pending ${request.scope} action. No execution happens until an allowed role approves it.`;

  const proposal: AgentTaskProposal = {
    id: `proposal-${commandId}`,
    commandId,
    title,
    reasoning,
    risk,
    scope: request.scope,
    agentId: agent.id,
    agentName: agent.name,
    timestamp,
  };
  const message: AgentTaskMessage = {
    id: `agent-message-${commandId}`,
    author: 'agent',
    body: `${agent.name} prepared a gated command proposal for "${title}". Review it in Command Inbox before anything can run.`,
    timestamp,
  };
  const commandEvent: MissionControlEvent = {
    type: 'command',
    command: {
      id: commandId,
      title,
      summary: request.objective,
      source: 'agent-console',
      goalId: request.goalId,
      evidenceIds: request.evidenceIds,
      agent: {
        agentId: agent.id,
        agentName: agent.name,
        profile: agent.profile,
      },
      reasoning,
      expectedResult,
      scope: request.scope,
      risk,
      status: 'pending',
      requestedAt: timestamp,
      execution: {
        status: 'not-started',
        result: 'Waiting in Command Inbox for human approval.',
        rollbackAvailable: risk === 'safe',
      },
      auditTrail: [
        {
          id: `audit-${commandId}-proposed`,
          type: 'proposed',
          actor: 'agent-console',
          timestamp,
          detail: `${agent.name} proposed "${title}" from Agent Console.`,
        },
        ...(request.goalId
          ? [
              {
                id: `audit-${commandId}-goal`,
                type: 'proposed' as const,
                actor: 'goal-runtime',
                timestamp,
                detail: `Proposal linked to goal ${request.goalId}.`,
              },
            ]
          : []),
      ],
    },
  };
  const notificationEvent: MissionControlEvent = {
    type: 'notification',
    notification: {
      id: `notification-${commandId}`,
      level: risk === 'critical' ? 'critical' : risk === 'elevated' ? 'warning' : 'notice',
      title: 'Agent proposal ready',
      body: `Command Inbox is holding "${title}" for approval.`,
      source: 'agent-console',
      timestamp,
      acknowledged: false,
      relatedCommandId: commandId,
    },
  };

  return {
    message,
    proposals: [proposal],
    missionControlEvents: [commandEvent, notificationEvent],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAgentTaskGatewayResult(value: unknown): value is AgentTaskGatewayResult {
  return (
    isRecord(value) &&
    isRecord(value.message) &&
    typeof value.message.id === 'string' &&
    Array.isArray(value.proposals) &&
    Array.isArray(value.missionControlEvents)
  );
}

function normalizeAgentTaskGatewayResult(value: unknown): AgentTaskGatewayResult {
  if (!isAgentTaskGatewayResult(value)) {
    throw new Error('Agent bridge task endpoint returned an invalid proposal payload.');
  }

  return {
    ...value,
    missionControlEvents: normalizeMissionControlEventList(value.missionControlEvents),
  };
}

function getBridgeTaskUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/u, '')}/tasks`;
}

export function createMockAgentTaskGateway(options: AgentTaskGatewayOptions = {}): AgentTaskGateway {
  const delayMs = options.delayMs ?? 260;

  return {
    mode: 'mock',
    async submitTask(request) {
      await wait(delayMs);
      return createMockTaskResult(request);
    },
  };
}

export function createBackendAgentTaskGateway(url: string): AgentTaskGateway {
  return {
    mode: 'backend',
    async submitTask(request) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Agent task backend returned ${response.status}.`);
      }

      const body: unknown = await response.json();
      return normalizeAgentTaskGatewayResult(body);
    },
  };
}

export function createBridgeAgentTaskGateway(
  baseUrl: string,
  options: AgentTaskFetchGatewayOptions = {},
): AgentTaskGateway {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    mode: 'bridge',
    async submitTask(request) {
      const response = await fetchImpl(getBridgeTaskUrl(baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Agent bridge task endpoint returned ${response.status}.`);
      }

      const body: unknown = await response.json();
      return normalizeAgentTaskGatewayResult(body);
    },
  };
}

export function createAgentTaskGateway(url?: string | null): AgentTaskGateway {
  if (url?.trim()) return createBackendAgentTaskGateway(url);
  return createMockAgentTaskGateway();
}
