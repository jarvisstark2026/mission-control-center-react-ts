import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readStorageText, removeLocalStorageItem, writeStorageText } from '../workspace/browserStorage';
import { setWorkspacePersistenceAdapter } from '../workspace/workspacePersistence';
import { initializeDesktopPersistence } from './desktopPersistence';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

type TestTauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

describe('desktop persistence', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    setWorkspacePersistenceAdapter(null);
    window.localStorage.clear();
  });

  afterEach(() => {
    delete (window as TestTauriWindow).__TAURI_INTERNALS__;
    setWorkspacePersistenceAdapter(null);
    window.localStorage.clear();
  });

  it('keeps browser preview on localStorage when Tauri is unavailable', async () => {
    expect(await initializeDesktopPersistence()).toBe(false);

    expect(writeStorageText('mission-control-test', 'browser')).toBe(true);
    expect(window.localStorage.getItem('mission-control-test')).toBe('browser');
  });

  it('preloads Tauri app-data state and mirrors writes through commands', async () => {
    (window as TestTauriWindow).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValueOnce({ 'mission-control-test': 'desktop' });

    expect(await initializeDesktopPersistence()).toBe(true);
    expect(readStorageText('mission-control-test')).toBe('desktop');
    expect(window.localStorage.getItem('mission-control-test')).toBeNull();

    expect(writeStorageText('mission-control-test', 'updated')).toBe(true);
    expect(invokeMock).toHaveBeenLastCalledWith('write_app_state', {
      key: 'mission-control-test',
      value: 'updated',
    });

    expect(removeLocalStorageItem('mission-control-test')).toBe(true);
    expect(invokeMock).toHaveBeenLastCalledWith('remove_app_state', {
      key: 'mission-control-test',
    });
  });
});
