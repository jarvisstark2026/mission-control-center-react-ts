import type { MissionControlRuntime } from '../../mission-control';
import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { WorkspaceCompactList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';
import type { WorkspaceWidgetGroup } from '../workspaceManagerModel';

export function OverviewWidget({
  missionControl,
  workspaceGroups = [],
  role,
  operationalOs,
}: {
  missionControl?: MissionControlRuntime;
  workspaceGroups?: WorkspaceWidgetGroup[];
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
  const state = missionControl?.state;
  const unreadAlerts = state?.notifications.filter((notification) => !notification.acknowledged).length ?? 0;
  const pendingCommands = state?.commands.filter((command) => command.status === 'pending').length ?? 0;
  const openWidgets = workspaceGroups.reduce((total, group) => total + group.widgets.filter((widget) => widget.open && !widget.hidden).length, 0);
  const onWorkspaces = workspaceGroups.filter((group) => group.active || group.widgets.some((widget) => widget.open && !widget.hidden)).length || 1;
  const latestTelemetry = state?.telemetry[0] ?? null;
  const updatedAt = state?.lastUpdatedAt ? new Date(state.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'local';
  const stats = [
    { label: 'alerts', value: unreadAlerts },
    { label: 'pending', value: pendingCommands },
    { label: 'widgets', value: openWidgets },
    { label: 'workspaces on', value: onWorkspaces, wide: true },
  ];
  const compactRows = [
    {
      id: 'telemetry',
      meta: state?.connection ?? 'local',
      title: latestTelemetry ? `${latestTelemetry.label} ${latestTelemetry.value}${latestTelemetry.unit}` : 'No live telemetry sample',
      detail: latestTelemetry ? latestTelemetry.severity : 'source waiting',
      state: latestTelemetry?.severity === 'critical' ? 'failed' : latestTelemetry?.severity === 'warning' ? 'warning' : 'ready',
    },
    {
      id: 'commands',
      meta: 'gate',
      title: pendingCommands ? `${pendingCommands} commands waiting` : 'Command Inbox clear',
      detail: 'human approval',
      state: pendingCommands ? 'pending' : 'ready',
    },
  ];

  return (
    <WorkspaceContentShell className="overview-surface">
      <WorkspaceContentHeader
        eyebrow="System overview"
        title="current operating state"
        metaEyebrow={state?.connection ?? 'local'}
        meta={updatedAt}
      />
      <WorkspaceStatusStrip
        source={state?.connection === 'connected' ? 'live' : 'local'}
        status={pendingCommands ? `${pendingCommands} decisions waiting` : 'workspace ready'}
        count={`${openWidgets} open widgets`}
        updatedAt={updatedAt}
      />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={createRuntimeSnapshotEvidenceInput(
          'Mission Control overview snapshot',
          'overview-widget',
          `${pendingCommands} pending commands / ${unreadAlerts} unread alerts / ${openWidgets} open widgets / ${onWorkspaces} workspaces on`,
        )}
      />
      <WorkspaceSectionFrame className="overview-dashboard" eyebrow="telemetry" title="command summary" meta={`${stats.length} signals`}>
        <div className="widget-grid">
          <div className="stats-arc" />
          <WorkspaceMetricGrid metrics={stats} />
        </div>
        <WorkspaceCompactList items={compactRows} empty="No local state is available yet." ariaLabel="Overview status rows" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
