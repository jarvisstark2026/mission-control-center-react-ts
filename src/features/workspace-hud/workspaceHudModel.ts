import type { AgentControlState } from '../agent-control';
import type {
  IntegrationStatus,
  MissionControlSeverity,
  MissionControlState,
  TelemetrySample,
} from '../mission-control/missionControlTypes';
import type { ShellRole } from '../shell/roles';
import type { WorkspaceHudMetric, WorkspaceHudSignals, WorkspaceHudTelemetrySignal } from './workspaceHudTypes';

type WorkspaceHudWidgetSnapshot = {
  open: boolean;
  hidden?: boolean;
};

type WorkspaceHudWorkspaceGroup = {
  workspaceId: string;
  widgets: WorkspaceHudWidgetSnapshot[];
};

export type WorkspaceHudSignalInput = {
  missionState: MissionControlState;
  agentState: AgentControlState;
  workspaceGroups: WorkspaceHudWorkspaceGroup[];
  activeModeLabel: string;
  activeRole: ShellRole;
  locale?: string;
};

const severityWeight: Record<MissionControlSeverity, number> = {
  nominal: 0,
  notice: 1,
  warning: 2,
  critical: 3,
};

function getHighestSeverity(severities: MissionControlSeverity[]): MissionControlSeverity {
  return severities.reduce<MissionControlSeverity>(
    (highest, severity) => (severityWeight[severity] > severityWeight[highest] ? severity : highest),
    'nominal',
  );
}

function formatTelemetryValue(sample: TelemetrySample, formatter: Intl.NumberFormat) {
  const formattedValue = formatter.format(sample.value);
  return sample.unit ? `${formattedValue}${sample.unit}` : formattedValue;
}

function getLatestTelemetrySignals(
  telemetry: TelemetrySample[],
  formatter: Intl.NumberFormat,
): WorkspaceHudTelemetrySignal[] {
  return telemetry
    .slice()
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 4)
    .map((sample) => ({
      id: sample.id,
      channel: sample.channel,
      label: sample.label,
      value: formatTelemetryValue(sample, formatter),
      trend: sample.trend,
      severity: sample.severity,
      timestamp: sample.timestamp,
    }));
}

function countIntegrationsByStatus(statuses: IntegrationStatus[], status: IntegrationStatus) {
  return statuses.filter((item) => item === status).length;
}

function getSourceLabel(connection: MissionControlState['connection']) {
  if (connection === 'mock') return 'local/mock';
  if (connection === 'connected') return 'live';
  if (connection === 'connecting') return 'connecting';
  return 'error';
}

function createMetric({
  id,
  label,
  value,
  detail,
  severity = 'nominal',
}: {
  id: string;
  label: string;
  value: string;
  detail?: string;
  severity?: MissionControlSeverity;
}): WorkspaceHudMetric {
  return { id, label, value, detail, severity };
}

export function createWorkspaceHudSignals({
  missionState,
  agentState,
  workspaceGroups,
  activeModeLabel,
  activeRole,
  locale,
}: WorkspaceHudSignalInput): WorkspaceHudSignals {
  const formatter = new Intl.NumberFormat(locale);
  const pendingCommands = missionState.commands.filter((command) => command.status === 'pending').length;
  const activeCommands = missionState.commands.filter((command) => command.status === 'queued' || command.status === 'running').length;
  const criticalPendingCommands = missionState.commands.filter(
    (command) => command.status === 'pending' && command.risk === 'critical',
  ).length;
  const unacknowledgedNotifications = missionState.notifications.filter((notification) => !notification.acknowledged).length;
  const highestNotificationSeverity = getHighestSeverity(
    missionState.notifications
      .filter((notification) => !notification.acknowledged)
      .map((notification) => notification.level),
  );
  const integrationStatuses = missionState.integrations.map((integration) => integration.status);
  const integrationHealth = {
    online: countIntegrationsByStatus(integrationStatuses, 'online'),
    degraded: countIntegrationsByStatus(integrationStatuses, 'degraded'),
    offline: countIntegrationsByStatus(integrationStatuses, 'offline'),
  };
  const widgetOpenCount = workspaceGroups.reduce(
    (count, group) => count + group.widgets.filter((widget) => widget.open && !widget.hidden).length,
    0,
  );
  const telemetry = getLatestTelemetrySignals(missionState.telemetry, formatter);
  const activeAgent =
    agentState.agents.find((agent) => agent.id === agentState.activeAgentId) ??
    agentState.agents.find((agent) => agent.id === agentState.identity.id);

  return {
    sourceLabel: getSourceLabel(missionState.connection),
    connection: missionState.connection,
    role: activeRole,
    activeModeLabel,
    workspaceOnCount: workspaceGroups.length,
    widgetOpenCount,
    pendingCommands,
    activeCommands,
    unacknowledgedNotifications,
    highestNotificationSeverity,
    integrationHealth,
    agent: {
      name: activeAgent?.name ?? agentState.identity.name,
      status: activeAgent?.status ?? agentState.identity.status,
      connection: activeAgent?.connection ?? agentState.identity.connection,
      profile: activeAgent?.profile ?? agentState.identity.profile,
      model: activeAgent?.model ?? agentState.identity.model,
    },
    telemetry,
    metrics: [
      createMetric({
        id: 'commands',
        label: 'pending commands',
        value: formatter.format(pendingCommands),
        detail: activeCommands ? `${formatter.format(activeCommands)} active` : undefined,
        severity: criticalPendingCommands > 0 ? 'critical' : pendingCommands > 0 ? 'notice' : 'nominal',
      }),
      createMetric({
        id: 'notifications',
        label: 'alerts',
        value: formatter.format(unacknowledgedNotifications),
        detail: highestNotificationSeverity,
        severity: highestNotificationSeverity,
      }),
      createMetric({
        id: 'integrations',
        label: 'integrations',
        value: formatter.format(missionState.integrations.length),
        detail: `${formatter.format(integrationHealth.online)} online / ${formatter.format(integrationHealth.degraded)} degraded`,
        severity: integrationHealth.offline > 0 ? 'critical' : integrationHealth.degraded > 0 ? 'warning' : 'nominal',
      }),
      createMetric({
        id: 'workspaces',
        label: 'ON workspaces',
        value: formatter.format(workspaceGroups.length),
        detail: `${formatter.format(widgetOpenCount)} open widgets`,
        severity: 'nominal',
      }),
    ],
    lastUpdatedAt: missionState.lastUpdatedAt,
  };
}
