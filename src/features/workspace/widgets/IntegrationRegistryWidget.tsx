import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import {
  canEditIntegrationPermission,
  type IntegrationPermission,
  type IntegrationRecord,
  type MissionControlRuntime,
} from '../../mission-control';

const permissionOptions: IntegrationPermission[] = ['read', 'control', 'blocked'];

function getIntegrationStatusSummary(integrations: IntegrationRecord[]) {
  return {
    online: integrations.filter((integration) => integration.status === 'online').length,
    degraded: integrations.filter((integration) => integration.status === 'degraded').length,
    offline: integrations.filter((integration) => integration.status === 'offline').length,
  };
}

export function IntegrationRegistryWidget({ missionControl }: { missionControl: MissionControlRuntime }) {
  const { devices, integrations } = missionControl.state;
  const summary = getIntegrationStatusSummary(integrations);
  const canEditPermissions = canEditIntegrationPermission(missionControl.role);

  return (
    <WorkspaceContentShell className="mission-control-surface integration-registry-surface">
      <WorkspaceContentHeader
        eyebrow="Integration registry"
        title="devices, heartbeats, and permissions"
        metaEyebrow="scope"
        meta={missionControl.role}
      />
      <WorkspaceSummaryPanel
        className="mission-control-summary"
        title={`${summary.online} online / ${summary.degraded} degraded / ${summary.offline} offline`}
      >
        Registry data is typed and permission-aware. Current records are local/mock until a real integration backend supplies heartbeats.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="integrations"
        title="connected systems"
        meta={`${integrations.length} tracked`}
      >
        <div className="mission-control-card-list" role="list" aria-label="Integration registry">
          {integrations.map((integration) => (
            <article className="mission-control-card" key={integration.id} role="listitem" data-state={integration.status}>
              <div className="mission-control-card-head">
                <div>
                  <span>{integration.category} / {integration.status}</span>
                  <strong>{integration.name}</strong>
                </div>
                <small>{integration.permission}</small>
              </div>
              <p>{integration.scope} scope / heartbeat {new Date(integration.heartbeatAt).toLocaleTimeString()}</p>
              <div className="mission-control-actions">
                {permissionOptions.map((permission) => (
                  <WorkspaceButton
                    key={permission}
                    variant={integration.permission === permission ? 'primary' : 'secondary'}
                    className="mission-control-action"
                    disabled={!canEditPermissions}
                    aria-pressed={integration.permission === permission}
                    onClick={() => missionControl.setIntegrationPermission(integration.id, permission)}
                  >
                    {permission}
                  </WorkspaceButton>
                ))}
              </div>
            </article>
          ))}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="inventory"
        title="device heartbeat map"
        meta={`${devices.length} devices`}
      >
        <div className="mission-control-compact-list" role="list" aria-label="Device inventory">
          {devices.map((device) => (
            <div className="mission-control-row" key={device.id} role="listitem" data-state={device.status}>
              <span>{device.name}</span>
              <strong>{device.zone}</strong>
              <small>{device.status}</small>
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
