import type { ShellRole } from '../shell/roles';
import type { CommandRisk, CommandScope, MissionControlEvent } from '../mission-control';

export type AgentTaskScope = CommandScope;
export type AgentTaskStatus = 'idle' | 'drafting' | 'proposed' | 'blocked' | 'failed';
export type AgentTaskGatewayMode = 'mock' | 'backend' | 'bridge';
export type AgentTaskMessageAuthor = 'user' | 'agent' | 'system';
export type AgentTaskSource = 'agent-console' | 'agent-control' | 'workflow';

export type AgentTaskMessage = {
  id: string;
  author: AgentTaskMessageAuthor;
  body: string;
  timestamp: string;
  goalId?: string;
  commandId?: string;
  workflowRunId?: string;
  status?: 'sent' | 'failed' | 'proposal-created';
  retryRequest?: AgentTaskRequest;
};

export type AgentTaskProposal = {
  id: string;
  commandId: string;
  title: string;
  reasoning: string;
  risk: CommandRisk;
  scope: AgentTaskScope;
  agentId: string;
  agentName: string;
  timestamp: string;
};

export type AgentTaskRequest = {
  id: string;
  objective: string;
  scope: AgentTaskScope;
  risk: CommandRisk;
  role: ShellRole;
  targetAgentId: string;
  goalId?: string;
  evidenceIds?: string[];
  workflowRunId?: string;
  workflowStepId?: string;
  source?: AgentTaskSource;
  requestedAt: string;
};

export type AgentTaskGatewayResult = {
  message: AgentTaskMessage;
  proposals: AgentTaskProposal[];
  missionControlEvents: MissionControlEvent[];
};

export type AgentTaskingState = {
  messages: AgentTaskMessage[];
  proposals: AgentTaskProposal[];
  status: AgentTaskStatus;
  gatewayMode: AgentTaskGatewayMode;
  lastRequest?: AgentTaskRequest;
  error?: string;
  version: number;
  updatedAt: string;
};
