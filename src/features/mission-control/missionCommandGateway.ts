import type { ShellRole } from '../shell/roles';
import type { CommandAction, CommandExecutionStatus, CommandRequest } from './missionControlTypes';

export type MissionCommandGatewayMode = 'mock' | 'backend' | 'allowlist';

export type MissionCommandExecutionRequest = {
  command: CommandRequest;
  action: Extract<CommandAction, 'approve' | 'override'>;
  role: ShellRole;
  requestedAt: string;
};

export type MissionCommandExecutionResult = {
  status: Extract<CommandExecutionStatus, 'succeeded' | 'failed'>;
  result: string;
  rollbackAvailable: boolean;
  completedAt: string;
  gatewayMode: MissionCommandGatewayMode;
};

export type MissionCommandGateway = {
  mode: MissionCommandGatewayMode;
  executeCommand: (request: MissionCommandExecutionRequest) => Promise<MissionCommandExecutionResult>;
};

type MissionCommandGatewayOptions = {
  delayMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getBackendString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getBackendBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

export function createMockMissionCommandGateway(options: MissionCommandGatewayOptions = {}): MissionCommandGateway {
  const delayMs = options.delayMs ?? 360;

  return {
    mode: 'mock',
    async executeCommand({ command, action }) {
      await wait(delayMs);

      return {
        status: 'succeeded',
        result: `Local dry-run gateway completed "${command.title}". No external systems were changed.`,
        rollbackAvailable: action === 'approve' && command.risk === 'safe',
        completedAt: new Date().toISOString(),
        gatewayMode: 'mock',
      };
    },
  };
}

export function createBackendMissionCommandGateway(url: string): MissionCommandGateway {
  return {
    mode: 'backend',
    async executeCommand(request) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          commandId: request.command.id,
          action: request.action,
          role: request.role,
          requestedAt: request.requestedAt,
          command: request.command,
        }),
      });

      if (!response.ok) {
        return {
          status: 'failed',
          result: `Backend command gateway returned ${response.status}.`,
          rollbackAvailable: false,
          completedAt: new Date().toISOString(),
          gatewayMode: 'backend',
        };
      }

      const body: unknown = await response.json().catch(() => null);
      const record = isRecord(body) ? body : {};
      const status = record.status === 'failed' ? 'failed' : 'succeeded';

      return {
        status,
        result: getBackendString(record.result, status === 'succeeded' ? 'Backend command completed.' : 'Backend command failed.'),
        rollbackAvailable: getBackendBoolean(record.rollbackAvailable, false),
        completedAt: getBackendString(record.completedAt, new Date().toISOString()),
        gatewayMode: 'backend',
      };
    },
  };
}

const allowlistedCommandSourcePrefixes = [
  'native-app:',
  'home-systems:',
  'workflow-runbook',
  'agent-bridge:',
  'agent-console',
  'agent-control',
];

function isAllowlistedCommand(command: CommandRequest) {
  return allowlistedCommandSourcePrefixes.some((prefix) => command.source === prefix || command.source.startsWith(prefix));
}

export function createAllowlistedMissionCommandGateway(options: MissionCommandGatewayOptions = {}): MissionCommandGateway {
  const delayMs = options.delayMs ?? 220;

  return {
    mode: 'allowlist',
    async executeCommand({ command, action, role }) {
      await wait(delayMs);

      if (!isAllowlistedCommand(command)) {
        return {
          status: 'failed',
          result: `Allowlisted command executor rejected "${command.title}" because source "${command.source}" is not registered.`,
          rollbackAvailable: false,
          completedAt: new Date().toISOString(),
          gatewayMode: 'allowlist',
        };
      }
      if (command.risk === 'critical' && role !== 'admin') {
        return {
          status: 'failed',
          result: `Allowlisted command executor rejected "${command.title}" because critical actions require admin approval.`,
          rollbackAvailable: false,
          completedAt: new Date().toISOString(),
          gatewayMode: 'allowlist',
        };
      }

      return {
        status: 'succeeded',
        result: `Allowlisted Mission Control executor accepted "${command.title}" after ${action}. External systems are changed only by registered adapters.`,
        rollbackAvailable: command.risk === 'safe',
        completedAt: new Date().toISOString(),
        gatewayMode: 'allowlist',
      };
    },
  };
}

export function createMissionCommandGateway(url?: string | null, mode?: string | null): MissionCommandGateway {
  if (url?.trim()) {
    return createBackendMissionCommandGateway(url);
  }
  if (mode === 'allowlist') {
    return createAllowlistedMissionCommandGateway();
  }

  return createMockMissionCommandGateway();
}
