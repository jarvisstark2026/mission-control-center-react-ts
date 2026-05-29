import { WorkspaceButton, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { canAcknowledgeNotifications, type MissionControlRuntime } from '../../mission-control';
import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { AttentionCard } from '../operationalBlocks';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';

export function NotificationsWidget({
  missionControl,
  role,
  operationalOs,
}: {
  missionControl: MissionControlRuntime;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
  const { notifications, telemetry, connection } = missionControl.state;
  const commandTitleById = new Map(missionControl.state.commands.map((command) => [command.id, command.title]));
  const unreadNotifications = notifications.filter((notification) => !notification.acknowledged);
  const canAcknowledge = canAcknowledgeNotifications(missionControl.role);
  const latestTelemetry = telemetry[0];
  const notificationGroups = (['critical', 'warning', 'notice'] as const).map((level) => ({
    level,
    items: notifications.filter((notification) => notification.level === level).slice(0, 5),
  }));
  const telemetryMetrics = telemetry.slice(0, 4).map((sample) => ({
    label: sample.label,
    value: `${sample.value}${sample.unit}`,
  }));
  const sourceMetrics = Array.from(new Set(notifications.map((notification) => notification.source))).sort().slice(0, 6).map((source) => ({
    label: source,
    value: notifications.filter((notification) => notification.source === source).length,
  }));

  return (
    <WorkspaceContentShell className="mission-control-surface notifications-surface">
      <WorkspaceStatusStrip
        source={connection === 'connected' ? 'bridge' : 'local'}
        status={latestTelemetry ? `${latestTelemetry.label} ${latestTelemetry.value}${latestTelemetry.unit}` : 'Telemetry ready'}
        count={`${unreadNotifications.length} unread`}
        updatedAt={connection === 'connected' ? 'SSE stream' : 'local seed events'}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="sources"
        title="alert origins"
        meta={`${sourceMetrics.length} groups`}
      >
        <WorkspaceMetricGrid className="mission-control-metrics" metrics={sourceMetrics} />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="telemetry"
        title="latest samples"
        meta={`${telemetry.length} buffered`}
      >
        <WorkspaceMetricGrid className="mission-control-metrics" metrics={telemetryMetrics} />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="feed"
        title="system notifications"
        meta={`${unreadNotifications.length} unread`}
      >
        <div className="mission-control-card-list" role="list" aria-label="Mission notifications">
          {notificationGroups.map((group) =>
            group.items.length ? (
              <WorkspaceSectionFrame
                key={group.level}
                className="mission-control-list-frame"
                eyebrow="severity"
                title={group.level}
                meta={`${group.items.length} visible`}
              >
                {group.items.map((notification) => (
                  <AttentionCard
                    key={notification.id}
                    label={`${notification.source} / ${notification.acknowledged ? 'acknowledged' : 'new'}`}
                    title={notification.title}
                    risk={notification.level}
                    actions={
                      !notification.acknowledged ? (
                        <WorkspaceButton
                          variant="secondary"
                          className="mission-control-action"
                          disabled={!canAcknowledge}
                          onClick={() => missionControl.acknowledgeNotification(notification.id)}
                        >
                          Acknowledge
                        </WorkspaceButton>
                      ) : null
                    }
                  >
                    <p>{notification.body}</p>
                    {notification.relatedCommandId ? (
                      <small>
                        Related command: {commandTitleById.get(notification.relatedCommandId) ?? notification.relatedCommandId}
                      </small>
                    ) : null}
                  </AttentionCard>
                ))}
              </WorkspaceSectionFrame>
            ) : null,
          )}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={createRuntimeSnapshotEvidenceInput(
          'Notification feed snapshot',
          connection === 'connected' ? 'notifications-bridge' : 'notifications-local',
          `${notifications.length} notifications / ${unreadNotifications.length} unread / ${telemetry.length} telemetry samples`,
        )}
        disabled={!notifications.length && !telemetry.length}
        disabledReason={!notifications.length && !telemetry.length ? 'Notifications or telemetry are required before attaching evidence.' : undefined}
      />
    </WorkspaceContentShell>
  );
}
