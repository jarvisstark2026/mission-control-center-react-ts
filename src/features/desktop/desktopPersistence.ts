import { invoke } from '@tauri-apps/api/core';

import { setWorkspacePersistenceAdapter, type WorkspacePersistenceAdapter } from '../workspace/workspacePersistence';

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

type PersistedDesktopState = Record<string, string>;

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

function createDesktopPersistenceAdapter(initialState: PersistedDesktopState): WorkspacePersistenceAdapter {
  const state = new Map(Object.entries(initialState));

  return {
    readText(key) {
      return state.get(key) ?? null;
    },
    writeText(key, value) {
      state.set(key, value);
      void Promise.resolve(invoke('write_app_state', { key, value })).catch(() => undefined);
      return true;
    },
    remove(key) {
      state.delete(key);
      void Promise.resolve(invoke('remove_app_state', { key })).catch(() => undefined);
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
