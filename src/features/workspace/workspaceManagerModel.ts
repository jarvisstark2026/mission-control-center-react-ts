import type { WorkspaceActionRow } from './workspaceBlocks';
import type { WorkspaceWidget } from './workspaceTypes';

export type WorkspaceWidgetGroup = {
  workspaceId: string;
  label: string;
  active: boolean;
  widgets: WorkspaceWidget[];
};

export type TrackedWorkspaceWidgetGroup = WorkspaceWidgetGroup & {
  manageableWidgets: WorkspaceWidget[];
  visibleWidgets: WorkspaceWidget[];
  openWidgetCount: number;
};

export function getManagedWidgetId(workspaceId: string, widgetId: string) {
  return `${workspaceId}::${widgetId}`;
}

export function getTrackedWorkspaceWidgetGroups(workspaceGroups: WorkspaceWidgetGroup[]): TrackedWorkspaceWidgetGroup[] {
  return workspaceGroups.map((group) => {
    const manageableWidgets = group.widgets.filter((widget) => widget.kind !== 'window-manager');
    const visibleWidgets = manageableWidgets.filter((widget) => !widget.hidden);
    const openWidgetCount = visibleWidgets.filter((widget) => widget.open).length;

    return {
      ...group,
      manageableWidgets,
      visibleWidgets,
      openWidgetCount,
    };
  });
}

export function getWorkspaceWidgetGroupSummary(groups: TrackedWorkspaceWidgetGroup[]) {
  return {
    open: groups.reduce((count, group) => count + group.openWidgetCount, 0),
    visible: groups.reduce((count, group) => count + group.visibleWidgets.length, 0),
    total: groups.reduce((count, group) => count + group.manageableWidgets.length, 0),
  };
}

export function getManagedWidgetRows(group: TrackedWorkspaceWidgetGroup): WorkspaceActionRow[] {
  return group.visibleWidgets.map((widget) => ({
    id: getManagedWidgetId(group.workspaceId, widget.id),
    primary: widget.title,
    secondary: widget.open ? 'open' : 'minimized',
    meta: `${widget.kind} - z${widget.zIndex}${widget.pinned ? ' - pinned' : ''}`,
    pinned: widget.pinned,
  }));
}

export function getWidgetForManagedRow(group: TrackedWorkspaceWidgetGroup, rowId: string) {
  return group.visibleWidgets.find((widget) => rowId === getManagedWidgetId(group.workspaceId, widget.id)) ?? null;
}
