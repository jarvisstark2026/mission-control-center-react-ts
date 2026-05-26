import type { ShellRole } from '../shell/roles';
import {
  initialCommands,
  initialDevices,
  initialIntegrations,
  initialNotifications,
  initialTelemetrySamples,
} from './missionControlMock';
import type {
  CommandAuditEntry,
  CommandAction,
  CommandExecutionStatus,
  CommandExecutionState,
  CommandRequest,
  CommandStatus,
  IntegrationPermission,
  MissionControlConnectionState,
  MissionControlEvent,
  MissionControlState,
  MissionNotification,
} from './missionControlTypes';

export const missionControlBufferLimits = {
  telemetry: 72,
  notifications: 36,
  commands: 48,
  auditEntries: 18,
};

export type MissionControlReducerAction =
  | {
      type: 'events';
      events: MissionControlEvent[];
    }
  | {
      type: 'connection';
      connection: MissionControlConnectionState;
    }
  | {
      type: 'command-action';
      commandId: string;
      action: CommandAction;
      role: ShellRole;
    }
  | {
      type: 'command-execution';
      commandId: string;
      status: Extract<CommandExecutionStatus, 'queued' | 'running' | 'succeeded' | 'failed'>;
      result: string;
      actor: string;
      timestamp: string;
      rollbackAvailable?: boolean;
    }
  | {
      type: 'acknowledge-notification';
      notificationId: string;
      role: ShellRole;
    }
  | {
      type: 'set-integration-permission';
      integrationId: string;
      permission: IntegrationPermission;
      role: ShellRole;
    };

function nowIso() {
  return new Date().toISOString();
}

function capNewest<T>(items: T[], limit: number) {
  return items.slice(0, limit);
}

function upsertNewest<T extends { id: string }>(items: T[], nextItem: T, limit: number) {
  return capNewest([nextItem, ...items.filter((item) => item.id !== nextItem.id)], limit);
}

function updateById<T extends { id: string }>(items: T[], id: string, update: (item: T) => T) {
  return items.map((item) => (item.id === id ? update(item) : item));
}

function capCommandAuditTrail(auditTrail: CommandAuditEntry[]) {
  return auditTrail.slice(-missionControlBufferLimits.auditEntries);
}

export function createInitialMissionControlState(): MissionControlState {
  return {
    telemetry: [...initialTelemetrySamples],
    notifications: [...initialNotifications],
    commands: [...initialCommands],
    integrations: [...initialIntegrations],
    devices: [...initialDevices],
    connection: 'mock',
    version: 0,
    lastUpdatedAt: initialTelemetrySamples[0]?.timestamp ?? nowIso(),
  };
}

export function getAllowedCommandActions(command: CommandRequest, role: ShellRole): CommandAction[] {
  if (command.status !== 'pending') return [];

  if (role === 'admin') {
    return command.risk === 'critical' ? ['approve', 'reject', 'block', 'override'] : ['approve', 'reject', 'block'];
  }

  if (role === 'support') {
    return command.risk === 'safe' ? ['reject'] : ['reject', 'block'];
  }

  if (role === 'home' && command.scope === 'household' && command.risk === 'safe') {
    return ['approve', 'reject'];
  }

  return [];
}

export function canAcknowledgeNotifications(role: ShellRole) {
  return role !== 'guest';
}

export function canEditIntegrationPermission(role: ShellRole) {
  return role === 'admin';
}

function getCommandStatusForAction(action: CommandAction): CommandStatus {
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  if (action === 'block') return 'blocked';
  return 'overridden';
}

function getCommandStatusForExecution(status: CommandExecutionStatus): CommandStatus {
  if (status === 'blocked') return 'blocked';
  if (status === 'not-started') return 'pending';
  return status;
}

function getCommandAuditTypeForAction(action: CommandAction): CommandAuditEntry['type'] {
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  if (action === 'block') return 'blocked';
  return 'overridden';
}

function getCommandExecutionForDecision(command: CommandRequest, action: CommandAction, decidedAt: string): CommandExecutionState {
  if (action === 'approve' || action === 'override') {
    return {
      status: 'queued',
      result: 'Queued for local dry-run. No external systems are changed.',
      rollbackAvailable: action === 'approve' && command.risk === 'safe',
      startedAt: decidedAt,
    };
  }

  return {
    status: 'blocked',
    result: action === 'block' ? 'Blocked by operator decision.' : 'Rejected by operator decision.',
    rollbackAvailable: false,
    completedAt: decidedAt,
  };
}

function createCommandAuditEntryForType({
  command,
  type,
  actor,
  timestamp,
  detail,
}: {
  command: CommandRequest;
  type: CommandAuditEntry['type'];
  actor: string;
  timestamp: string;
  detail: string;
}): CommandAuditEntry {
  return {
    id: `audit-${command.id}-${type}-${timestamp}`,
    type,
    actor,
    timestamp,
    detail,
  };
}

function createCommandAuditEntry(command: CommandRequest, action: CommandAction, role: ShellRole, timestamp: string): CommandAuditEntry {
  const type = getCommandAuditTypeForAction(action);

  return createCommandAuditEntryForType({
    command,
    type,
    actor: role,
    timestamp,
    detail: `${command.title} was ${type} by ${role}.`,
  });
}

function createCommandExecutionAuditEntry(
  command: CommandRequest,
  status: Extract<CommandExecutionStatus, 'queued' | 'running' | 'succeeded' | 'failed'>,
  actor: string,
  timestamp: string,
  result: string,
): CommandAuditEntry {
  return createCommandAuditEntryForType({
    command,
    type: status,
    actor,
    timestamp,
    detail: result,
  });
}

function createCommandDecisionNotification(command: CommandRequest, status: CommandStatus, role: ShellRole): MissionNotification {
  const level: MissionNotification['level'] = status === 'approved' ? 'notice' : status === 'overridden' ? 'critical' : 'warning';

  return {
    id: `notification-${command.id}-${status}`,
    level,
    title: `Command ${status}`,
    body: `${command.title} was ${status} by ${role}.`,
    source: 'command-inbox',
    timestamp: command.decidedAt ?? nowIso(),
    acknowledged: false,
    relatedCommandId: command.id,
  };
}

function applyMissionControlEvent(state: MissionControlState, event: MissionControlEvent): MissionControlState {
  const timestamp =
    event.type === 'telemetry'
      ? event.sample.timestamp
      : event.type === 'notification'
        ? event.notification.timestamp
        : event.type === 'command'
          ? event.command.requestedAt
          : event.type === 'integration'
            ? event.integration.heartbeatAt
            : event.device.lastSeenAt;

  if (event.type === 'telemetry') {
    return {
      ...state,
      telemetry: upsertNewest(state.telemetry, event.sample, missionControlBufferLimits.telemetry),
      version: state.version + 1,
      lastUpdatedAt: timestamp,
    };
  }

  if (event.type === 'notification') {
    return {
      ...state,
      notifications: upsertNewest(state.notifications, event.notification, missionControlBufferLimits.notifications),
      version: state.version + 1,
      lastUpdatedAt: timestamp,
    };
  }

  if (event.type === 'command') {
    return {
      ...state,
      commands: upsertNewest(state.commands, event.command, missionControlBufferLimits.commands),
      version: state.version + 1,
      lastUpdatedAt: timestamp,
    };
  }

  if (event.type === 'integration') {
    return {
      ...state,
      integrations: upsertNewest(state.integrations, event.integration, state.integrations.length + 1),
      version: state.version + 1,
      lastUpdatedAt: timestamp,
    };
  }

  return {
    ...state,
    devices: upsertNewest(state.devices, event.device, state.devices.length + 1),
    version: state.version + 1,
    lastUpdatedAt: timestamp,
  };
}

function transitionCommand(state: MissionControlState, commandId: string, action: CommandAction, role: ShellRole) {
  const command = state.commands.find((item) => item.id === commandId);
  if (!command || !getAllowedCommandActions(command, role).includes(action)) return state;

  const status = getCommandStatusForAction(action);
  const decidedAt = nowIso();
  const commandStatus: CommandStatus = action === 'approve' || action === 'override' ? 'queued' : status;
  const execution = getCommandExecutionForDecision(command, action, decidedAt);
  const auditTrail = [createCommandAuditEntry(command, action, role, decidedAt)];

  if (execution.status === 'queued') {
    auditTrail.push(
      createCommandExecutionAuditEntry(
        command,
        'queued',
        'command-gateway',
        decidedAt,
        'Command accepted by the browser gateway queue.',
      ),
    );
  }

  const nextCommand = {
    ...command,
    status: commandStatus,
    decidedAt,
    decidedBy: role,
    execution,
    auditTrail: capCommandAuditTrail([...command.auditTrail, ...auditTrail]),
  };

  return {
    ...state,
    commands: upsertNewest(
      state.commands.map((item) => (item.id === commandId ? nextCommand : item)),
      nextCommand,
      missionControlBufferLimits.commands,
    ),
    notifications: upsertNewest(
      state.notifications,
      createCommandDecisionNotification(nextCommand, status, role),
      missionControlBufferLimits.notifications,
    ),
    version: state.version + 1,
    lastUpdatedAt: decidedAt,
  };
}

function transitionCommandExecution(
  state: MissionControlState,
  commandId: string,
  status: Extract<CommandExecutionStatus, 'queued' | 'running' | 'succeeded' | 'failed'>,
  result: string,
  actor: string,
  timestamp: string,
  rollbackAvailable?: boolean,
) {
  const command = state.commands.find((item) => item.id === commandId);
  if (!command || command.status === 'pending') return state;

  const nextCommand = {
    ...command,
    status: getCommandStatusForExecution(status),
    execution: {
      ...command.execution,
      status,
      result,
      rollbackAvailable: rollbackAvailable ?? command.execution.rollbackAvailable,
      startedAt: command.execution.startedAt ?? (status === 'queued' || status === 'running' ? timestamp : undefined),
      completedAt: status === 'succeeded' || status === 'failed' ? timestamp : command.execution.completedAt,
    },
    auditTrail: capCommandAuditTrail([
      ...command.auditTrail,
      createCommandExecutionAuditEntry(command, status, actor, timestamp, result),
    ]),
  };

  return {
    ...state,
    commands: upsertNewest(
      state.commands.map((item) => (item.id === commandId ? nextCommand : item)),
      nextCommand,
      missionControlBufferLimits.commands,
    ),
    version: state.version + 1,
    lastUpdatedAt: timestamp,
  };
}

export function missionControlReducer(
  state: MissionControlState,
  action: MissionControlReducerAction,
): MissionControlState {
  if (action.type === 'connection') {
    if (state.connection === action.connection) return state;
    return {
      ...state,
      connection: action.connection,
      version: state.version + 1,
      lastUpdatedAt: nowIso(),
    };
  }

  if (action.type === 'events') {
    return action.events.reduce(applyMissionControlEvent, state);
  }

  if (action.type === 'command-action') {
    return transitionCommand(state, action.commandId, action.action, action.role);
  }

  if (action.type === 'command-execution') {
    return transitionCommandExecution(
      state,
      action.commandId,
      action.status,
      action.result,
      action.actor,
      action.timestamp,
      action.rollbackAvailable,
    );
  }

  if (action.type === 'acknowledge-notification') {
    if (!canAcknowledgeNotifications(action.role)) return state;

    return {
      ...state,
      notifications: updateById(state.notifications, action.notificationId, (notification) => ({
        ...notification,
        acknowledged: true,
      })),
      version: state.version + 1,
      lastUpdatedAt: nowIso(),
    };
  }

  if (!canEditIntegrationPermission(action.role)) return state;

  return {
    ...state,
    integrations: updateById(state.integrations, action.integrationId, (integration) => ({
      ...integration,
      permission: action.permission,
    })),
    version: state.version + 1,
    lastUpdatedAt: nowIso(),
  };
}
