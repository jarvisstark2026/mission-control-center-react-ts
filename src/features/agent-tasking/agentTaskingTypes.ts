import type { ShellRole } from '../shell/roles';
import type { CommandRisk, CommandScope, MissionControlEvent } from '../mission-control';

export type AgentTaskScope = CommandScope;
export type AgentTaskStatus = 'idle' | 'drafting' | 'proposed' | 'blocked' | 'failed';
export type AgentTaskGatewayMode = 'mock' | 'backend' | 'bridge';
export type AgentTaskMessageAuthor = 'user' | 'agent' | 'system';

export type AgentTaskMessage = {
  id: string;
  author: AgentTaskMessageAuthor;
  body: string;
  timestamp: string;
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
