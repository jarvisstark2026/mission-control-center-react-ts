import type { WorkspaceHudSettings } from '../workspace-hud';
import type { WorkspacePlacement } from '../workspace/workspaceInstances';
import type { WidgetKind } from '../workspace/workspaceTypes';

export type HermesHudMessageRole = 'user' | 'assistant' | 'system';

export type HermesHudMessageStatus = 'sent' | 'received' | 'failed' | 'action-result';

export type HermesHudStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'responding' | 'voice-unavailable' | 'error';

export type HermesHudMessage = {
  id: string;
  role: HermesHudMessageRole;
  body: string;
  timestamp: string;
  status: HermesHudMessageStatus;
  actionResults?: HermesHudDirectActionResult[];
};

export type HermesHudDirectAction =
  | {
      type: 'widget.open' | 'widget.focus' | 'widget.minimize' | 'widget.close';
      widgetKind?: WidgetKind;
      widgetId?: string;
      reason?: string;
    }
  | {
      type: 'widget.updateState';
      widgetKind?: WidgetKind;
      widgetId?: string;
      patch?: {
        open?: boolean;
        pinned?: boolean;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        title?: string;
        subtitle?: string;
      };
      reason?: string;
    }
  | {
      type: 'hud.update';
      settings?: Partial<WorkspaceHudSettings>;
      reason?: string;
    }
  | {
      type: 'liveLayout.set';
      placement?: WorkspacePlacement;
      enabled?: boolean;
      reason?: string;
    }
  | {
      type: 'home.action';
      actionId?: string;
      targetId?: string;
      payload?: unknown;
      reason?: string;
    };

export type HermesHudDirectActionResult = {
  id: string;
  type: string;
  ok: boolean;
  message: string;
  timestamp: string;
};

export type HermesHudChatResponse = {
  message?: {
    id?: string;
    role?: 'assistant';
    body?: string;
    timestamp?: string;
  };
  directActions?: HermesHudDirectAction[];
};

export type HermesHudTranscribeResponse = {
  transcript?: string;
  text?: string;
  confidence?: number;
  language?: string;
};
