import { memo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { WorkspaceWidgetContent, type WorkspaceWidgetContentProps } from './WorkspaceWidgetContent';
import { WorkspaceWindow } from './WorkspaceWindow';
import type { ResizeEdge } from './WorkspaceResizeHandles';
import type { WorkspaceWidget } from './workspaceTypes';
import type { WorkspaceWidgetTransferAnimation } from './workspaceWidgetTransfer';
import type { WorkspaceWidgetGroup } from './workspaceManagerModel';

type WorkspaceWidgetCardProps = {
  widget: WorkspaceWidget;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => void;
  onToggleOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRecenter: (id: string) => void;
  onClose: (id: string) => void;
  showChrome?: boolean;
  transferAnimation?: WorkspaceWidgetTransferAnimation | null;
} & WorkspaceWidgetContentProps;

export type WorkspaceWidgetRuntimeProps = Omit<WorkspaceWidgetCardProps, 'widget' | 'showChrome' | 'transferAnimation'>;

function getWidgetStateSignature(widget: WorkspaceWidget) {
  return `${widget.id}:${widget.kind}:${widget.open ? 1 : 0}:${widget.hidden ? 1 : 0}:${widget.pinned ? 1 : 0}:${widget.zIndex}`;
}

function getWidgetCollectionSignature(widgets: WorkspaceWidget[]) {
  return widgets.map(getWidgetStateSignature).join('|');
}

function getWorkspaceGroupSignature(groups: WorkspaceWidgetGroup[]) {
  return groups
    .map((group) => `${group.workspaceId}:${group.label}:${group.active ? 1 : 0}:${getWidgetCollectionSignature(group.widgets)}`)
    .join('||');
}

function isWidgetFrameEqual(left: WorkspaceWidget, right: WorkspaceWidget) {
  return (
    left === right ||
    (left.id === right.id &&
      left.kind === right.kind &&
      left.title === right.title &&
      left.subtitle === right.subtitle &&
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height &&
      left.zIndex === right.zIndex &&
      left.open === right.open &&
      left.hidden === right.hidden &&
      left.pinned === right.pinned &&
      left.surfaceAlpha === right.surfaceAlpha &&
      left.lineAlpha === right.lineAlpha &&
      left.minWidth === right.minWidth &&
      left.minHeight === right.minHeight &&
      left.previewFileId === right.previewFileId)
  );
}

function isTransferAnimationEqual(
  left: WorkspaceWidgetTransferAnimation | null | undefined,
  right: WorkspaceWidgetTransferAnimation | null | undefined,
) {
  return (
    left === right ||
    (left?.direction === right?.direction && left?.phase === right?.phase)
  );
}

function isWorkspaceWidgetCardEqual(left: WorkspaceWidgetCardProps, right: WorkspaceWidgetCardProps) {
  if (!isWidgetFrameEqual(left.widget, right.widget)) return false;
  if (left.showChrome !== right.showChrome) return false;
  if (!isTransferAnimationEqual(left.transferAnimation, right.transferAnimation)) return false;

  switch (right.widget.kind) {
    case 'file-explorer':
      return (
        left.localFiles === right.localFiles &&
        left.activeLocalFileId === right.activeLocalFileId &&
        left.selectedLocalFileId === right.selectedLocalFileId &&
        left.folderEntries === right.folderEntries &&
        left.folderPath === right.folderPath &&
        left.canBrowseFolder === right.canBrowseFolder
      );
    case 'trading-graph':
    case 'news':
      return left.activeMarketGraph.id === right.activeMarketGraph.id;
    case 'launcher':
      return getWidgetCollectionSignature(left.workspaceWidgets) === getWidgetCollectionSignature(right.workspaceWidgets);
    case 'window-manager':
      return getWorkspaceGroupSignature(left.workspaceWidgetGroups) === getWorkspaceGroupSignature(right.workspaceWidgetGroups);
    case 'command-inbox':
    case 'notifications':
    case 'integration-registry':
      return (
        left.missionControl.role === right.missionControl.role &&
        left.missionControl.state.version === right.missionControl.state.version
      );
    case 'agent-control':
      return left.activeRole === right.activeRole && left.agentControl.version === right.agentControl.version;
    case '3d':
      return left.widget.previewFileId === right.widget.previewFileId && left.localFiles === right.localFiles;
    default:
      return true;
  }
}

function WorkspaceWidgetCardComponent({
  widget,
  onStartDrag,
  onStartResize,
  onToggleOpen,
  onTogglePin,
  onRecenter,
  onClose,
  showChrome = true,
  transferAnimation = null,
  ...contentProps
}: WorkspaceWidgetCardProps) {
  return (
    <WorkspaceWindow
      widget={widget}
      bodyClassName="widget-body"
      onStartDrag={onStartDrag}
      onStartResize={onStartResize}
      onToggleOpen={onToggleOpen}
      onTogglePin={onTogglePin}
      onRecenter={onRecenter}
      onClose={onClose}
      showChrome={showChrome}
      transferAnimation={transferAnimation}
    >
      <WorkspaceWidgetContent widget={widget} {...contentProps} />
    </WorkspaceWindow>
  );
}

export const WorkspaceWidgetCard = memo(WorkspaceWidgetCardComponent, isWorkspaceWidgetCardEqual);
