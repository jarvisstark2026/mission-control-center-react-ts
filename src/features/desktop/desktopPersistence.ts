import { invoke } from '@tauri-apps/api/core';

import {
  emitWorkspacePersistenceChange,
  setWorkspacePersistenceAdapter,
  type WorkspacePersistenceAdapter,
  type WorkspacePersistenceChangeDetail,
} from '../workspace/workspacePersistence';

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

type PersistedDesktopState = Record<string, string>;
type DesktopPersistenceMessage = WorkspacePersistenceChangeDetail;
const desktopPersistenceChannelName = 'mission-control.desktop-persistence';

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

function createDesktopPersistenceAdapter(initialState: PersistedDesktopState): WorkspacePersistenceAdapter {
  const state = new Map(Object.entries(initialState));
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(desktopPersistenceChannelName);

  const applyChange = (detail: DesktopPersistenceMessage) => {
    if (detail.action === 'remove') {
      state.delete(detail.key);
    } else {
      state.set(detail.key, detail.value ?? '');
    }

    emitWorkspacePersistenceChange(detail);
  };

  channel?.addEventListener('message', (event: MessageEvent<DesktopPersistenceMessage>) => {
    if (!event.data?.key) return;
    applyChange(event.data);
  });

  return {
    readText(key) {
      return state.get(key) ?? null;
    },
    writeText(key, value) {
      state.set(key, value);
      void Promise.resolve(invoke('write_app_state', { key, value })).catch(() => undefined);
      const detail = { key, action: 'write' as const, value };
      channel?.postMessage(detail);
      return true;
    },
    remove(key) {
      state.delete(key);
      void Promise.resolve(invoke('remove_app_state', { key })).catch(() => undefined);
      const detail = { key, action: 'remove' as const };
      channel?.postMessage(detail);
      return true;
    },
    keys() {
      return Array.from(state.keys());
    },
  };
}

export async function initializeDesktopPersistence() {
  if (!isTauriRuntime()) return false;

  try {
    const state = await invoke<PersistedDesktopState>('load_app_state');
    setWorkspacePersistenceAdapter(createDesktopPersistenceAdapter(state));
    return true;
  } catch {
    return false;
  }
}
