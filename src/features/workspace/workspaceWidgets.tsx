import type { PointerEvent as ReactPointerEvent } from 'react';

import { WorkspaceWidgetContent, type WorkspaceWidgetContentProps } from './WorkspaceWidgetContent';
import { WorkspaceWindow } from './WorkspaceWindow';
import type { ResizeEdge } from './WorkspaceResizeHandles';
import type { WorkspaceWidget } from './workspaceTypes';
import type { WorkspaceWidgetTransferAnimation } from './workspaceWidgetTransfer';

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

export function WorkspaceWidgetCard({
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
