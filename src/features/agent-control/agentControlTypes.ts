import type { ShellRole } from '../shell/roles';

export type AgentConnectionState = 'online' | 'degraded' | 'offline' | 'reconnecting';
export type AgentJobStatus = 'active' | 'paused' | 'failed' | 'completed';
export type AgentJobKind = 'cron' | 'monitor' | 'automation';
export type AgentPermissionLevel = 'read' | 'suggest' | 'execute' | 'blocked';
export type AgentPermissionRisk = 'low' | 'medium' | 'high';
export type AgentPermissionCategory = 'files' | 'workspace' | 'integrations' | 'commands' | 'network' | 'automation';
export type AgentActivityKind = 'proposal' | 'approval' | 'execution' | 'failure' | 'connection';
export type AgentProfile = 'home-operator' | 'support-diagnostics' | 'security-watch' | 'guest-readonly';
export type AgentSpecialty = 'coordinator' | 'support' | 'security' | 'home' | 'workflow';
export type AgentConnectorKind = 'local' | 'remote' | 'mock';
export type AgentConnectorStatus = 'connected' | 'available' | 'offline' | 'error' | 'not-configured';
export type AgentRuntimeProvider = 'hermes' | 'openclaw' | 'openai' | 'custom';
export type AgentBridgeDiagnosticLevel = 'info' | 'warning' | 'error';
export type AgentBridgeDiagnosticSource = 'status' | 'events' | 'tasks' | 'runtime' | 'settings';
export type AgentBridgeEventStreamStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type AgentBridgeTutorialStepStatus = 'waiting' | 'pass' | 'failed';

export type AgentVisibleRole = Exclude<ShellRole, 'guest'>;

export type AgentDescriptor = {
  id: string;
  name: string;
  specialty: AgentSpecialty;
  provider: string;
  model: string;
  profile: AgentProfile;
  status: 'available' | 'working' | 'waiting' | 'limited';
  connection: AgentConnectionState;
  summary: string;
  visibleTo: AgentVisibleRole[];
};

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

export type AgentConnectorRecord = {
  id: string;
  provider: AgentRuntimeProvider;
  kind: AgentConnectorKind;
  url: string | null;
  status: AgentConnectorStatus;
  lastSeenAt: string | null;
  healthCheckedAt?: string | null;
  activeEngine?: string | null;
  sourcePriority?: number;
  capabilities: string[];
  error: string | null;
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

export type AgentBridgeDiagnostic = {
  id: string;
  connectorId: string;
  level: AgentBridgeDiagnosticLevel;
  message: string;
  source: AgentBridgeDiagnosticSource;
  timestamp: string;
  payloadSummary?: string;
};

export type AgentBridgeTutorialStep = {
  id: string;
  title: string;
  body: string;
  status: AgentBridgeTutorialStepStatus;
  command?: string;
};

export type AgentControlState = {
  identity: AgentIdentity;
  agents: AgentDescriptor[];
  activeAgentId: string;
  connectors: AgentConnectorRecord[];
  activeConnectorId: string;
  eventStreamStatus: AgentBridgeEventStreamStatus;
  lastBridgeEventAt: string | null;
  diagnostics: AgentBridgeDiagnostic[];
  usage: AgentUsageSummary;
  jobs: AgentScheduledJob[];
  permissions: AgentPermission[];
  activity: AgentActivity[];
  version: number;
  updatedAt: string;
};
