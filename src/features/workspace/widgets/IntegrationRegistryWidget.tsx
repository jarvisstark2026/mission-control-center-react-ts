import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { PermissionBadge } from '../operationalBlocks';
import {
  canEditIntegrationPermission,
  type IntegrationPermission,
  type IntegrationRecord,
  type MissionControlRuntime,
} from '../../mission-control';

const permissionOptions: IntegrationPermission[] = ['read', 'control', 'blocked'];

function getIntegrationStatusCounts(integrations: IntegrationRecord[]) {
  return {
    online: integrations.filter((integration) => integration.status === 'online').length,
    degraded: integrations.filter((integration) => integration.status === 'degraded').length,
    offline: integrations.filter((integration) => integration.status === 'offline').length,
  };
}

export function IntegrationRegistryWidget({ missionControl }: { missionControl: MissionControlRuntime }) {
  const { devices, integrations } = missionControl.state;
  const summary = getIntegrationStatusCounts(integrations);
  const canEditPermissions = canEditIntegrationPermission(missionControl.role);
  const integrationGroups = Array.from(new Set(integrations.map((integration) => integration.category))).map((category) => ({
    category,
    items: integrations.filter((integration) => integration.category === category),
  }));

  return (
    <WorkspaceContentShell className="mission-control-surface integration-registry-surface">
      <WorkspaceContentHeader
        eyebrow="Integration registry"
        title="devices, heartbeats, and permissions"
        metaEyebrow="scope"
        meta={missionControl.role}
      />
      <WorkspaceStatusStrip
        source={summary.online > 0 ? 'bridge' : integrations.length ? 'local' : 'unavailable'}
        status={`${summary.online} online / ${summary.degraded} degraded`}
        count={`${summary.offline} offline`}
        updatedAt={missionControl.role}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="integrations"
        title="connected systems"
        meta={`${integrations.length} tracked`}
      >
        <div className="mission-control-card-list" role="list" aria-label="Integration registry">
          {integrationGroups.map((group) => (
            <WorkspaceSectionFrame
              key={group.category}
              className="mission-control-list-frame"
              eyebrow="system group"
              title={group.category}
              meta={`${group.items.length} records`}
            >
              {group.items.map((integration) => (
                <article className="mission-control-card" key={integration.id} role="listitem" data-state={integration.status}>
                  <div className="mission-control-card-head">
                    <div>
                      <span>{integration.status} / {integration.scope}</span>
                      <strong>{integration.name}</strong>
                    </div>
                    <PermissionBadge level={integration.permission} />
                  </div>
                  <p>
                    Heartbeat {new Date(integration.heartbeatAt).toLocaleTimeString()}. Scope {integration.scope}; actions from this
                    system must arrive as proposals before they can run.
                  </p>
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
            </WorkspaceSectionFrame>
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
