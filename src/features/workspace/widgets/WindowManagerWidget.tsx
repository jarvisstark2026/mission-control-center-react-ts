import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { WorkspaceActionRowList, WorkspaceCompactList, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createWindowStateEvidenceInput } from '../workspaceEvidenceModel';
import {
  getManagedWidgetRows,
  getTrackedWorkspaceWidgetGroups,
  getWorkspaceWidgetGroupSummary,
  type WorkspaceWidgetGroup,
} from '../workspaceManagerModel';

export function WindowManagerWidget({
  workspaceGroups,
  onFocusWidget,
  onTogglePinWidget,
  onCloseWidget,
  role,
  operationalOs,
}: {
  workspaceGroups: WorkspaceWidgetGroup[];
  onFocusWidget: (id: string) => void;
  onTogglePinWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
  const trackedGroups = getTrackedWorkspaceWidgetGroups(workspaceGroups);
  const summary = getWorkspaceWidgetGroupSummary(trackedGroups);
  const evidenceInput = createWindowStateEvidenceInput(workspaceGroups);
  const pinnedCount = trackedGroups.reduce((count, group) => count + group.visibleWidgets.filter((widget) => widget.pinned).length, 0);
  const workspaceRows = trackedGroups.map((group) => ({
    id: group.workspaceId,
    meta: group.active ? 'active' : 'workspace',
    title: group.label,
    detail: `${group.visibleWidgets.length} visible / ${group.openWidgetCount} open`,
    state: group.active ? 'ready' : 'pending',
  }));

  return (
    <WorkspaceContentShell className="window-manager-surface">
      <WorkspaceStatusStrip
        source="local"
        status={`${summary.visible} visible widgets`}
        count={`${trackedGroups.length} ON workspaces`}
        updatedAt={`${summary.open} open / ${summary.total} tracked`}
      />
      <WorkspaceCompactList
        items={workspaceRows}
        empty="No workspace windows are available to manage."
        ariaLabel="Workspace window summary"
      />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={evidenceInput}
        disabled={summary.visible === 0}
        disabledReason={summary.visible === 0 ? 'No visible workspace widgets are available to attach.' : `${summary.visible} visible / ${pinnedCount} pinned`}
      />
      {trackedGroups.map((group) => (
        <WorkspaceSectionFrame
          key={group.workspaceId}
          className="window-manager-list-frame"
          eyebrow={group.active ? 'current workspace' : 'workspace'}
          title={group.label}
          meta={`${group.visibleWidgets.length} visible - ${group.openWidgetCount} open`}
        >
          {group.visibleWidgets.length > 0 ? (
            <WorkspaceActionRowList
              className="window-manager-list"
              ariaLabel={`Visible widgets in ${group.label}`}
              rows={getManagedWidgetRows(group)}
              onFocusRow={onFocusWidget}
              onTogglePinRow={onTogglePinWidget}
              onCloseRow={onCloseWidget}
            />
          ) : (
            <p className="window-manager-empty">No visible widgets are active in this workspace.</p>
          )}
        </WorkspaceSectionFrame>
      ))}
    </WorkspaceContentShell>
  );
}
