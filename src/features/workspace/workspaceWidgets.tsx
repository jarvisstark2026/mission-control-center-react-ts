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
  onMaximize: (id: string) => void;
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

function getPermissionSignature(permissions: WorkspaceWidgetContentProps['widgetPermissions']) {
  return Object.entries(permissions)
    .map(([role, rolePermissions]) => `${role}:${Object.entries(rolePermissions).map(([kind, allowed]) => `${kind}:${allowed ? 1 : 0}`).join(',')}`)
    .join('|');
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
    case 'overview':
      return (
        left.missionControl.state.version === right.missionControl.state.version &&
        getWorkspaceGroupSignature(left.workspaceWidgetGroups) === getWorkspaceGroupSignature(right.workspaceWidgetGroups) &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'graph':
      return (
        left.missionControl.state.version === right.missionControl.state.version &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'browser':
    case 'map':
    case 'diagram':
    case 'watch-video':
    case 'native-app':
      return (
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'audio':
    case 'video':
      return (
        left.localFiles === right.localFiles &&
        left.activeLocalFileId === right.activeLocalFileId &&
        left.selectedLocalFileId === right.selectedLocalFileId &&
        left.agentControl.version === right.agentControl.version &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'file-explorer':
      return (
        left.localFiles === right.localFiles &&
        left.activeLocalFileId === right.activeLocalFileId &&
        left.selectedLocalFileId === right.selectedLocalFileId &&
        left.folderEntries === right.folderEntries &&
        left.folderPath === right.folderPath &&
        left.canBrowseFolder === right.canBrowseFolder &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'trading-graph':
    case 'news':
      return (
        left.activeMarketGraph.id === right.activeMarketGraph.id &&
        left.marketLiveData.status === right.marketLiveData.status &&
        left.marketLiveData.updatedAt === right.marketLiveData.updatedAt &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'launcher':
      return (
        left.activeRole === right.activeRole &&
        getWidgetCollectionSignature(left.workspaceWidgets) === getWidgetCollectionSignature(right.workspaceWidgets) &&
        getPermissionSignature(left.widgetPermissions) === getPermissionSignature(right.widgetPermissions)
      );
    case 'window-manager':
      return (
        getWorkspaceGroupSignature(left.workspaceWidgetGroups) === getWorkspaceGroupSignature(right.workspaceWidgetGroups) &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'command-inbox':
      return (
        left.missionControl.role === right.missionControl.role &&
        left.missionControl.state.version === right.missionControl.state.version &&
        left.operationalOs.state.version === right.operationalOs.state.version &&
        left.focusedCommandId === right.focusedCommandId
      );
    case 'goals':
    case 'app-portal':
    case 'json-surface':
    case 'docs':
    case 'sheet':
    case 'slides':
    case 'project':
    case 'schedule':
    case 'list':
      return (
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version &&
        left.missionControl.state.version === right.missionControl.state.version &&
        left.agentControl.version === right.agentControl.version
      );
    case 'notifications':
    case 'integration-registry':
    case 'home-systems':
      return (
        left.missionControl.role === right.missionControl.role &&
        left.missionControl.state.version === right.missionControl.state.version &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'agent-control':
      return (
        left.activeRole === right.activeRole &&
        left.agentControl.version === right.agentControl.version &&
        left.missionControl.state.version === right.missionControl.state.version &&
        left.agentBridgeSettings.localBridgeUrl === right.agentBridgeSettings.localBridgeUrl &&
        left.agentBridgeSettings.remoteApiUrl === right.agentBridgeSettings.remoteApiUrl &&
        left.agentBridgeSettings.bridgeMode === right.agentBridgeSettings.bridgeMode &&
        left.agentBridgeSettings.hermesHost === right.agentBridgeSettings.hermesHost &&
        left.agentBridgeSettings.hermesApiPort === right.agentBridgeSettings.hermesApiPort &&
        left.agentBridgeSettings.hermesApiKey === right.agentBridgeSettings.hermesApiKey &&
        left.agentBridgeSettings.hermesApiBaseUrl === right.agentBridgeSettings.hermesApiBaseUrl &&
        left.agentBridgeSettings.hermesModel === right.agentBridgeSettings.hermesModel &&
        left.agentBridgeSettings.preferredAgentId === right.agentBridgeSettings.preferredAgentId &&
        left.agentBridgeSettings.lastSuccessfulUrl === right.agentBridgeSettings.lastSuccessfulUrl
      );
    case 'agent-console':
      return (
        left.activeRole === right.activeRole &&
        left.agentControl.version === right.agentControl.version &&
        left.agentTaskGateway.mode === right.agentTaskGateway.mode &&
        left.agentBridgeSettings.preferredAgentId === right.agentBridgeSettings.preferredAgentId &&
        left.missionControl.state.version === right.missionControl.state.version &&
        left.operationalOs.state.version === right.operationalOs.state.version &&
        left.focusedCommandId === right.focusedCommandId
      );
    case 'flow':
      return (
        left.activeRole === right.activeRole &&
        left.agentControl.version === right.agentControl.version &&
        left.agentTaskGateway.mode === right.agentTaskGateway.mode &&
        left.missionControl.state.version === right.missionControl.state.version &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case '3d':
      return (
        left.widget.previewFileId === right.widget.previewFileId &&
        left.localFiles === right.localFiles &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case 'image':
    case 'pdf':
      return (
        left.localFiles === right.localFiles &&
        left.activeLocalFileId === right.activeLocalFileId &&
        left.selectedLocalFileId === right.selectedLocalFileId &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
    case '3d-studio':
      return (
        left.localFiles === right.localFiles &&
        left.activeLocalFileId === right.activeLocalFileId &&
        left.selectedLocalFileId === right.selectedLocalFileId &&
        left.activeRole === right.activeRole &&
        left.operationalOs.state.version === right.operationalOs.state.version
      );
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
  onMaximize,
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
      onMaximize={onMaximize}
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
