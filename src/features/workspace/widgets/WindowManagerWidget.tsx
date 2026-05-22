import { WorkspaceActionRowList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
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
}: {
  workspaceGroups: WorkspaceWidgetGroup[];
  onFocusWidget: (id: string) => void;
  onTogglePinWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
}) {
  const trackedGroups = getTrackedWorkspaceWidgetGroups(workspaceGroups);
  const summary = getWorkspaceWidgetGroupSummary(trackedGroups);

  return (
    <WorkspaceContentShell className="window-manager-surface">
      <WorkspaceContentHeader
        eyebrow="Manager"
        title="Workspace widgets and pinned surfaces"
        meta={`${summary.open} open - ${summary.visible} visible - ${summary.total} total`}
      />
      <WorkspaceSummaryPanel className="window-manager-note" title="window controls">
        Widgets are grouped by workspace. Pin widgets from this list or from each widget toolbar.
      </WorkspaceSummaryPanel>
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
