import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { canAcknowledgeNotifications, type MissionControlRuntime } from '../../mission-control';

export function NotificationsWidget({ missionControl }: { missionControl: MissionControlRuntime }) {
  const { notifications, telemetry, connection } = missionControl.state;
  const unreadNotifications = notifications.filter((notification) => !notification.acknowledged);
  const canAcknowledge = canAcknowledgeNotifications(missionControl.role);
  const latestTelemetry = telemetry[0];
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
      <WorkspaceSummaryPanel
        className="mission-control-summary"
        title={`${connection === 'connected' ? 'Live' : 'Mock'}: ${latestTelemetry ? `${latestTelemetry.label} ${latestTelemetry.value}${latestTelemetry.unit}` : 'telemetry ready'}`}
      >
        SSE is used when configured. Otherwise the deterministic mock stream keeps the operational surface alive and clearly marked.
      </WorkspaceSummaryPanel>

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
          {notifications.slice(0, 8).map((notification) => (
            <article
              className="mission-control-card mission-control-notification-card"
              key={notification.id}
              role="listitem"
              data-state={notification.level}
            >
              <div className="mission-control-card-head">
                <div>
                  <span>{notification.level} / {notification.source}</span>
                  <strong>{notification.title}</strong>
                </div>
                <small>{notification.acknowledged ? 'ack' : 'new'}</small>
              </div>
              <p>{notification.body}</p>
              {!notification.acknowledged ? (
                <div className="mission-control-actions">
                  <WorkspaceButton
                    variant="secondary"
                    className="mission-control-action"
                    disabled={!canAcknowledge}
                    onClick={() => missionControl.acknowledgeNotification(notification.id)}
                  >
                    Acknowledge
                  </WorkspaceButton>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
