import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame } from '../workspaceBlocks';
import { canAcknowledgeNotifications, type MissionControlRuntime } from '../../mission-control';
import { AttentionCard, StatusSummary } from '../operationalBlocks';

export function NotificationsWidget({ missionControl }: { missionControl: MissionControlRuntime }) {
  const { notifications, telemetry, connection } = missionControl.state;
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

  return (
    <WorkspaceContentShell className="mission-control-surface notifications-surface">
      <WorkspaceContentHeader
        eyebrow="Notifications"
        title="live telemetry and alerts"
        metaEyebrow="transport"
        meta={connection}
      />
      <StatusSummary
        label={connection === 'connected' ? 'Live stream' : 'Mock stream'}
        title={latestTelemetry ? `${latestTelemetry.label} ${latestTelemetry.value}${latestTelemetry.unit}` : 'Telemetry ready'}
        detail="SSE is used when configured. Otherwise the deterministic mock stream keeps the operational surface alive and clearly marked."
        meta={`${unreadNotifications.length} unread`}
      />

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
                    {notification.relatedCommandId ? <small>Related command: {notification.relatedCommandId}</small> : null}
                  </AttentionCard>
                ))}
              </WorkspaceSectionFrame>
            ) : null,
          )}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
