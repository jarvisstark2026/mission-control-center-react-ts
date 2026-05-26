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
  onDiagnostic?: (message: string, payload?: unknown) => void;
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
  const taskSource = request.source ?? 'agent-console';
  const commandSource = taskSource === 'workflow' ? 'workflow-runbook' : taskSource;
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
    goalId: request.goalId,
    commandId,
    workflowRunId: request.workflowRunId,
    status: 'proposal-created',
  };
  const commandEvent: MissionControlEvent = {
    type: 'command',
    command: {
      id: commandId,
      title,
      summary: request.objective,
      source: commandSource,
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
      workflow: request.workflowRunId && request.workflowStepId
        ? {
            runId: request.workflowRunId,
            stepId: request.workflowStepId,
            workflowName: 'Workflow run',
          }
        : undefined,
      auditTrail: [
        {
          id: `audit-${commandId}-proposed`,
          type: 'proposed',
          actor: commandSource,
          timestamp,
          detail: `${agent.name} proposed "${title}" from ${taskSource === 'workflow' ? 'Workflow' : taskSource === 'agent-control' ? 'Agent Control' : 'Agent Console'}.`,
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
      source: commandSource,
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
    (value.message.author === 'user' || value.message.author === 'agent' || value.message.author === 'system') &&
    typeof value.message.body === 'string' &&
    typeof value.message.timestamp === 'string' &&
    Array.isArray(value.proposals) &&
    value.proposals.every(
      (proposal) =>
        isRecord(proposal) &&
        typeof proposal.id === 'string' &&
        typeof proposal.commandId === 'string' &&
        typeof proposal.title === 'string' &&
        typeof proposal.reasoning === 'string' &&
        ['safe', 'elevated', 'critical'].includes(proposal.risk as string) &&
        ['household', 'system', 'support', 'security'].includes(proposal.scope as string) &&
        typeof proposal.agentId === 'string' &&
        typeof proposal.agentName === 'string' &&
        typeof proposal.timestamp === 'string',
    ) &&
    Array.isArray(value.missionControlEvents)
  );
}

function normalizeAgentTaskGatewayResult(value: unknown): AgentTaskGatewayResult {
  if (!isAgentTaskGatewayResult(value)) {
    throw new Error('Agent bridge task endpoint returned an invalid proposal payload.');
  }
  const missionControlEvents = normalizeMissionControlEventList(value.missionControlEvents);
  if (missionControlEvents.length !== value.missionControlEvents.length) {
    throw new Error('Agent bridge task endpoint returned invalid mission events.');
  }

  return {
    ...value,
    missionControlEvents,
  };
}

function summarizeBridgeTaskError(status: number, body: unknown) {
  if (!isRecord(body)) {
    return {
      message: `Agent bridge task endpoint returned ${status}.`,
      payload: body,
    };
  }

  const errorCode = typeof body.errorCode === 'string' ? body.errorCode : null;
  const error = typeof body.error === 'string' ? body.error : `Agent bridge task endpoint returned ${status}.`;
  const hermesStatusCode = typeof body.hermesStatusCode === 'number' ? body.hermesStatusCode : null;
  const payloadSummary = typeof body.payloadSummary === 'string' ? body.payloadSummary : null;
  const prefix = errorCode ? `${errorCode}: ` : '';
  const suffix = hermesStatusCode ? ` (Hermes ${hermesStatusCode})` : '';
  const detail = payloadSummary ? ` ${payloadSummary}` : '';

  return {
    message: `${prefix}${error}${suffix}${detail}`.trim(),
    payload: body,
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
      let diagnosticEmitted = false;
      try {
        const response = await fetchImpl(getBridgeTaskUrl(baseUrl), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          let body: unknown = null;
          const rawBody = await response.text().catch(() => '');
          try {
            body = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            body = rawBody || null;
          }
          const summary = summarizeBridgeTaskError(response.status, body);
          options.onDiagnostic?.(summary.message, {
            requestId: request.id,
            objective: request.objective,
            response: summary.payload,
          });
          diagnosticEmitted = true;
          throw new Error(summary.message);
        }

        const body: unknown = await response.json();
        return normalizeAgentTaskGatewayResult(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Agent bridge task endpoint failed.';
        if (!diagnosticEmitted) {
          options.onDiagnostic?.(message, { requestId: request.id, objective: request.objective });
        }
        throw error;
      }
    },
  };
}

export function createAgentTaskGateway(url?: string | null): AgentTaskGateway {
  if (url?.trim()) return createBackendAgentTaskGateway(url);
  return createMockAgentTaskGateway();
}
