import { WorkspaceButton, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { PermissionBadge } from '../operationalBlocks';
import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';
import {
  canEditIntegrationPermission,
  type IntegrationPermission,
  type IntegrationRecord,
  type MissionControlRuntime,
} from '../../mission-control';
import { getStableIntegrationGroups } from './stableWidgetSlots';

const permissionOptions: IntegrationPermission[] = ['read', 'control', 'blocked'];

function getIntegrationStatusCounts(integrations: IntegrationRecord[]) {
  return {
    online: integrations.filter((integration) => integration.status === 'online').length,
    degraded: integrations.filter((integration) => integration.status === 'degraded').length,
    offline: integrations.filter((integration) => integration.status === 'offline').length,
  };
}

export function IntegrationRegistryWidget({
  missionControl,
  role,
  operationalOs,
}: {
  missionControl: MissionControlRuntime;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
  const { devices, integrations } = missionControl.state;
  const summary = getIntegrationStatusCounts(integrations);
  const canEditPermissions = canEditIntegrationPermission(missionControl.role);
  const integrationGroups = getStableIntegrationGroups(integrations);

  return (
    <WorkspaceContentShell className="mission-control-surface integration-registry-surface">
      <WorkspaceStatusStrip
        source={summary.online > 0 ? 'bridge' : integrations.length ? 'local' : 'unavailable'}
        status={`${summary.online} online / ${summary.degraded} degraded`}
        count={`${summary.offline} offline`}
        updatedAt={missionControl.role}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame integration-registry-list-section"
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
        className="mission-control-list-frame integration-registry-inventory-section"
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

      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={createRuntimeSnapshotEvidenceInput(
          'Integration registry snapshot',
          summary.online > 0 ? 'integrations-bridge' : integrations.length ? 'integrations-local' : 'integrations-unavailable',
          `${integrations.length} integrations / ${summary.online} online / ${summary.degraded} degraded / ${devices.length} devices`,
        )}
        disabled={!integrations.length && !devices.length}
        disabledReason={!integrations.length && !devices.length ? 'No integration or device records are available yet.' : undefined}
      />
    </WorkspaceContentShell>
  );
}
