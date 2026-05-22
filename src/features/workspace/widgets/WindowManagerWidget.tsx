import { WorkspaceActionRowList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { type WorkspaceWidget } from '../workspaceTypes';

export function WindowManagerWidget({
  widgets,
  onFocusWidget,
  onTogglePinWidget,
  onCloseWidget,
}: {
  widgets: WorkspaceWidget[];
  onFocusWidget: (id: string) => void;
  onTogglePinWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
}) {
  const manageableWidgets = widgets.filter((widget) => widget.kind !== 'window-manager');
  const visibleWidgets = manageableWidgets.filter((widget) => !widget.hidden);
  const openWidgetCount = visibleWidgets.filter((widget) => widget.open).length;

  return (
    <WorkspaceContentShell className="window-manager-surface">
      <WorkspaceContentHeader
        eyebrow="Manager"
        title="Workspace widgets and pinned surfaces"
        meta={`${openWidgetCount} open · ${visibleWidgets.length} visible · ${manageableWidgets.length} total`}
      />
      <WorkspaceSummaryPanel className="window-manager-note" title="window controls">
        Pin widgets from this list or from each widget toolbar. Pinned widgets stay visible and cannot be closed until unpinned.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="window-manager-list-frame" eyebrow="manager" title="visible surfaces" meta={`${visibleWidgets.length} tracked`}>
        {visibleWidgets.length > 0 ? (
          <WorkspaceActionRowList
            className="window-manager-list"
            ariaLabel="Visible workspace widgets"
            rows={visibleWidgets.map((widget) => ({
              id: widget.id,
              primary: widget.title,
              secondary: widget.open ? 'open' : 'minimized',
              meta: `${widget.kind} · z${widget.zIndex}${widget.pinned ? ' · pinned' : ''}`,
              pinned: widget.pinned,
            }))}
            onFocusRow={onFocusWidget}
            onTogglePinRow={onTogglePinWidget}
            onCloseRow={onCloseWidget}
          />
        ) : (
          <p className="window-manager-empty">No visible widgets are active in this workspace.</p>
        )}
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

