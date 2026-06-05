import type { ShellRole } from '../shell/roles';
import type { AgentTaskRequest, AgentTaskingState, AgentTaskScope } from './agentTaskingTypes';

export const agentTaskingBufferLimits = {
  messages: 28,
  proposals: 16,
};

export type AgentTaskingAction =
  | {
      type: 'request-started';
      request: AgentTaskRequest;
    }
  | {
      type: 'request-succeeded';
      message: AgentTaskingState['messages'][number];
      proposals: AgentTaskingState['proposals'];
      timestamp: string;
    }
  | {
      type: 'request-blocked';
      message: AgentTaskingState['messages'][number];
      timestamp: string;
    }
  | {
      type: 'request-failed';
      message: AgentTaskingState['messages'][number];
      error: string;
      timestamp: string;
    };

const roleScopeAccess: Record<ShellRole, AgentTaskScope[]> = {
  admin: ['household', 'system', 'support', 'security'],
  support: ['support', 'system'],
  home: ['household'],
  guest: [],
};

function nowIso() {
  return new Date().toISOString();
}

function capNewest<T>(items: T[], limit: number) {
  return items.slice(0, limit);
}

export function canViewAgentConsole(role: ShellRole) {
  return role !== 'guest';
}

export function canSubmitAgentTask(role: ShellRole, request: Pick<AgentTaskRequest, 'scope' | 'risk'>) {
  if (!canViewAgentConsole(role)) return false;
  if (!roleScopeAccess[role].includes(request.scope)) return false;
  if (role === 'home') return request.scope === 'household' && request.risk === 'safe';
  if (role === 'support') return request.risk !== 'critical';
  return true;
}

export function getAgentTaskScopesForRole(role: ShellRole): AgentTaskScope[] {
  return roleScopeAccess[role];
}

export function createInitialAgentTaskingState(): AgentTaskingState {
  const timestamp = nowIso();

  return {
    messages: [
      {
        id: 'agent-console-welcome',
        author: 'system',
        body: 'Agent proposals are ready. Describe an objective and the active agent will prepare a proposal for Command Inbox.',
        timestamp,
      },
    ],
    proposals: [],
    status: 'idle',
    gatewayMode: 'mock',
    version: 0,
    updatedAt: timestamp,
  };
}

export function agentTaskingReducer(state: AgentTaskingState, action: AgentTaskingAction): AgentTaskingState {
  if (action.type === 'request-started') {
    return {
      ...state,
      messages: capNewest(
        [
          {
            id: `${action.request.id}-user-message`,
            author: 'user',
            body: action.request.objective,
            timestamp: action.request.requestedAt,
            goalId: action.request.goalId,
            workflowRunId: action.request.workflowRunId,
            status: 'sent',
          },
          ...state.messages,
        ],
        agentTaskingBufferLimits.messages,
      ),
      status: 'drafting',
      lastRequest: action.request,
      error: undefined,
      version: state.version + 1,
      updatedAt: action.request.requestedAt,
    };
  }

  if (action.type === 'request-succeeded') {
    return {
      ...state,
      messages: capNewest([action.message, ...state.messages], agentTaskingBufferLimits.messages),
      proposals: capNewest([...action.proposals, ...state.proposals], agentTaskingBufferLimits.proposals),
      status: 'proposed',
      error: undefined,
      version: state.version + 1,
      updatedAt: action.timestamp,
    };
  }

  if (action.type === 'request-blocked') {
    return {
      ...state,
      messages: capNewest([action.message, ...state.messages], agentTaskingBufferLimits.messages),
      status: 'blocked',
      error: action.message.body,
      version: state.version + 1,
      updatedAt: action.timestamp,
    };
  }

  return {
    ...state,
    messages: capNewest([action.message, ...state.messages], agentTaskingBufferLimits.messages),
    status: 'failed',
    error: action.error,
    version: state.version + 1,
    updatedAt: action.timestamp,
  };
}
