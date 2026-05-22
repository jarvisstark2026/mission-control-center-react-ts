import type { ShellRole } from '../shell/roles';

export type AgentConnectionState = 'online' | 'degraded' | 'offline' | 'reconnecting';
export type AgentJobStatus = 'active' | 'paused' | 'failed' | 'completed';
export type AgentJobKind = 'cron' | 'monitor' | 'automation';
export type AgentPermissionLevel = 'read' | 'suggest' | 'execute' | 'blocked';
export type AgentPermissionRisk = 'low' | 'medium' | 'high';
export type AgentPermissionCategory = 'files' | 'workspace' | 'integrations' | 'commands' | 'network' | 'automation';
export type AgentActivityKind = 'proposal' | 'approval' | 'execution' | 'failure' | 'connection';
export type AgentProfile = 'home-operator' | 'support-diagnostics' | 'security-watch' | 'guest-readonly';

export type AgentVisibleRole = Exclude<ShellRole, 'guest'>;

export type AgentIdentity = {
  id: string;
  name: string;
  status: 'available' | 'working' | 'waiting' | 'limited';
  provider: string;
  model: string;
  profile: AgentProfile;
  connection: AgentConnectionState;
  activeProfileLabel: string;
  lastConnectedAt: string;
  currentTask: string;
};

export type AgentUsageSummary = {
  requestCount: number;
  approvedActionCount: number;
  rejectedActionCount: number;
  blockedActionCount: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  windowStartedAt: string;
};

export type AgentScheduledJob = {
  id: string;
  name: string;
  kind: AgentJobKind;
  status: AgentJobStatus;
  cadence: string;
  lastRunAt: string;
  nextRunAt: string;
  owner: string;
  safeForHome: boolean;
  description: string;
  visibleTo: AgentVisibleRole[];
};

export type AgentPermission = {
  id: string;
  label: string;
  category: AgentPermissionCategory;
  level: AgentPermissionLevel;
  risk: AgentPermissionRisk;
  description: string;
  visibleTo: AgentVisibleRole[];
};

export type AgentActivity = {
  id: string;
  kind: AgentActivityKind;
  title: string;
  detail: string;
  timestamp: string;
  source: string;
  status?: AgentJobStatus | 'approved' | 'blocked' | 'rejected' | 'sent' | 'overridden' | 'queued' | 'running' | 'succeeded' | 'failed';
  visibleTo: AgentVisibleRole[];
};

export type AgentControlState = {
  identity: AgentIdentity;
  usage: AgentUsageSummary;
  jobs: AgentScheduledJob[];
  permissions: AgentPermission[];
  activity: AgentActivity[];
  version: number;
  updatedAt: string;
};
