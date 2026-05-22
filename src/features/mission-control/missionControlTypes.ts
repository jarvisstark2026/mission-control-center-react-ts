import type { ShellRole } from '../shell/roles';

export type MissionControlSeverity = 'nominal' | 'notice' | 'warning' | 'critical';

export type TelemetryChannel = 'power' | 'network' | 'security' | 'comfort' | 'automation';

export type TelemetrySample = {
  id: string;
  channel: TelemetryChannel;
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  severity: MissionControlSeverity;
  timestamp: string;
};

export type MissionNotification = {
  id: string;
  level: Exclude<MissionControlSeverity, 'nominal'>;
  title: string;
  body: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  relatedCommandId?: string;
};

export type CommandScope = 'household' | 'system' | 'support' | 'security';
export type CommandRisk = 'safe' | 'elevated' | 'critical';
export type CommandStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'overridden'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';
export type CommandAction = 'approve' | 'reject' | 'block' | 'override';
export type CommandExecutionStatus = 'not-started' | 'queued' | 'running' | 'succeeded' | 'failed' | 'blocked';
export type CommandAuditEventType =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'overridden'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export type CommandAgentProvenance = {
  agentId: string;
  agentName: string;
  profile: string;
};

export type CommandWorkflowLink = {
  runId: string;
  stepId: string;
  workflowName: string;
};

export type CommandExecutionState = {
  status: CommandExecutionStatus;
  result: string;
  rollbackAvailable: boolean;
  startedAt?: string;
  completedAt?: string;
};

export type CommandAuditEntry = {
  id: string;
  type: CommandAuditEventType;
  actor: string;
  timestamp: string;
  detail: string;
};

export type CommandRequest = {
  id: string;
  title: string;
  summary: string;
  source: string;
  agent: CommandAgentProvenance;
  reasoning: string;
  expectedResult: string;
  scope: CommandScope;
  risk: CommandRisk;
  status: CommandStatus;
  requestedAt: string;
  execution: CommandExecutionState;
  auditTrail: CommandAuditEntry[];
  workflow?: CommandWorkflowLink;
  decidedAt?: string;
  decidedBy?: ShellRole;
};

export type IntegrationPermission = 'read' | 'control' | 'blocked';
export type IntegrationStatus = 'online' | 'degraded' | 'offline';

export type IntegrationRecord = {
  id: string;
  name: string;
  category: 'device' | 'service' | 'automation' | 'media' | 'security';
  status: IntegrationStatus;
  permission: IntegrationPermission;
  heartbeatAt: string;
  scope: CommandScope;
};

export type DeviceRecord = {
  id: string;
  name: string;
  integrationId: string;
  zone: string;
  status: IntegrationStatus;
  lastSeenAt: string;
};

export type MissionControlConnectionState = 'mock' | 'connecting' | 'connected' | 'error';

export type MissionControlEvent =
  | {
      type: 'telemetry';
      sample: TelemetrySample;
    }
  | {
      type: 'notification';
      notification: MissionNotification;
    }
  | {
      type: 'command';
      command: CommandRequest;
    }
  | {
      type: 'integration';
      integration: IntegrationRecord;
    }
  | {
      type: 'device';
      device: DeviceRecord;
    };

export type MissionControlState = {
  telemetry: TelemetrySample[];
  notifications: MissionNotification[];
  commands: CommandRequest[];
  integrations: IntegrationRecord[];
  devices: DeviceRecord[];
  connection: MissionControlConnectionState;
  version: number;
  lastUpdatedAt: string;
};
