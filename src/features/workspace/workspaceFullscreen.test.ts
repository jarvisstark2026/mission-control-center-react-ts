import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCurrentFullscreenState,
  isDesktopRuntime,
  setAllOpenWorkspacesFullscreen,
  setCurrentWorkspaceFullscreen,
} from './workspaceFullscreen';

type MockWindowHandle = {
  label: string;
  fullscreen: boolean;
  setFullscreen: ReturnType<typeof vi.fn>;
  isFullscreen: ReturnType<typeof vi.fn>;
};

let mockWindows: MockWindowHandle[] = [];

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWindows[0],
  getAllWindows: async () => mockWindows,
}));

function createMockWindow(label: string, fullscreen = false): MockWindowHandle {
  return {
    label,
    fullscreen,
    setFullscreen: vi.fn(async function setFullscreen(this: MockWindowHandle, nextFullscreen: boolean) {
      this.fullscreen = nextFullscreen;
    }),
    isFullscreen: vi.fn(async function isFullscreen(this: MockWindowHandle) {
      return this.fullscreen;
    }),
  };
}

describe('workspaceFullscreen', () => {
  let browserFullscreenElement: Element | null = null;

  beforeEach(() => {
    mockWindows = [createMockWindow('main')];
    browserFullscreenElement = null;
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => browserFullscreenElement,
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(async () => {
        browserFullscreenElement = document.documentElement;
      }),
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: vi.fn(async () => {
        browserFullscreenElement = null;
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to browser fullscreen when Tauri is unavailable', async () => {
    expect(isDesktopRuntime()).toBe(false);
    expect(await getCurrentFullscreenState()).toBe(false);

    const enterResult = await setCurrentWorkspaceFullscreen(true);

    expect(enterResult).toMatchObject({ ok: true, available: true, fullscreen: true });
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledOnce();
    expect(await getCurrentFullscreenState()).toBe(true);

    const exitResult = await setCurrentWorkspaceFullscreen(false);

    expect(exitResult).toMatchObject({ ok: true, available: true, fullscreen: false });
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
  });

  it('uses Tauri current-window fullscreen APIs when desktop runtime is available', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });

    expect(isDesktopRuntime()).toBe(true);

    const result = await setCurrentWorkspaceFullscreen(true);

    expect(result).toMatchObject({ ok: true, available: true, fullscreen: true });
    expect(mockWindows[0].setFullscreen).toHaveBeenCalledWith(true);
    expect(mockWindows[0].isFullscreen).toHaveBeenCalled();
    expect(await getCurrentFullscreenState()).toBe(true);
  });

  it('toggles fullscreen only for main and open workspace instance windows', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    mockWindows = [
      createMockWindow('main'),
      createMockWindow('workspace-instance-alpha'),
      createMockWindow('settings'),
      createMockWindow('workspace-instance-beta'),
    ];

    const result = await setAllOpenWorkspacesFullscreen(true);

    expect(result).toMatchObject({ ok: true, available: true, fullscreen: true, targetCount: 3 });
    expect(mockWindows[0].setFullscreen).toHaveBeenCalledWith(true);
    expect(mockWindows[1].setFullscreen).toHaveBeenCalledWith(true);
    expect(mockWindows[2].setFullscreen).not.toHaveBeenCalled();
    expect(mockWindows[3].setFullscreen).toHaveBeenCalledWith(true);
  });

  it('does not support all-workspace fullscreen in browser preview', async () => {
    const result = await setAllOpenWorkspacesFullscreen(true);

    expect(result).toMatchObject({ ok: false, available: false, fullscreen: false, targetCount: 0 });
    expect(mockWindows[0].setFullscreen).not.toHaveBeenCalled();
  });
});
