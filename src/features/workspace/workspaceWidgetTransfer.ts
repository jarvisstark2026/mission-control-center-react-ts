import type { WorkspaceTransferDirection } from './workspaceInstances';

export type WorkspaceWidgetTransferAnimation = {
  phase: 'incoming' | 'outgoing';
  direction: WorkspaceTransferDirection;
};

export type WorkspaceWidgetTransferMessage = {
  type: 'widget-transfer';
  widgetId: string;
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  direction: WorkspaceTransferDirection;
};

const channelName = 'mission-control.workspace-widget-transfer';

function createChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(channelName);
}

export function publishWidgetTransfer(message: Omit<WorkspaceWidgetTransferMessage, 'type'>) {
  const channel = createChannel();
  channel?.postMessage({ ...message, type: 'widget-transfer' } satisfies WorkspaceWidgetTransferMessage);
  channel?.close();
}

export function subscribeWidgetTransfer(workspaceId: string, onTransfer: (message: WorkspaceWidgetTransferMessage) => void) {
  const channel = createChannel();
  if (!channel) return () => undefined;

  const handleMessage = (event: MessageEvent<WorkspaceWidgetTransferMessage>) => {
    if (event.data?.type === 'widget-transfer' && event.data.targetWorkspaceId === workspaceId) {
      onTransfer(event.data);
    }
  };

  channel.addEventListener('message', handleMessage);

  return () => {
    channel.removeEventListener('message', handleMessage);
    channel.close();
  };
}
