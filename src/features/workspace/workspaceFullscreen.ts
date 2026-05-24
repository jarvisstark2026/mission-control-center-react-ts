type TauriRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

type TauriWindowHandle = {
  label: string;
  isFullscreen(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  onResized?(handler: () => void): Promise<() => void>;
  onFocusChanged?(handler: () => void): Promise<() => void>;
};

type TauriWindowApi = {
  getCurrentWindow(): TauriWindowHandle;
  getAllWindows(): Promise<TauriWindowHandle[]>;
};

export type WorkspaceFullscreenResult = {
  ok: boolean;
  available: boolean;
  fullscreen: boolean;
  targetCount?: number;
  error?: unknown;
};

export function isDesktopRuntime() {
  return typeof window !== 'undefined' && Boolean((window as TauriRuntimeWindow).__TAURI_INTERNALS__);
}

function isWorkspaceWindowLabel(label: string) {
  return label === 'main' || label.startsWith('workspace-instance-');
}

async function loadTauriWindowApi(): Promise<TauriWindowApi> {
  return import('@tauri-apps/api/window');
}

function getBrowserFullscreenState() {
  return typeof document !== 'undefined' && Boolean(document.fullscreenElement);
}

async function setBrowserFullscreen(enabled: boolean): Promise<WorkspaceFullscreenResult> {
  if (typeof document === 'undefined') {
    return { ok: false, available: false, fullscreen: false };
  }

  try {
    if (enabled) {
      if (document.fullscreenElement) {
        return { ok: true, available: true, fullscreen: true };
      }

      if (!document.documentElement.requestFullscreen) {
        return { ok: false, available: false, fullscreen: false };
      }

      await document.documentElement.requestFullscreen();
      return { ok: true, available: true, fullscreen: true };
    }

    if (!document.fullscreenElement) {
      return { ok: true, available: true, fullscreen: false };
    }

    if (!document.exitFullscreen) {
      return { ok: false, available: false, fullscreen: true };
    }

    await document.exitFullscreen();
    return { ok: true, available: true, fullscreen: false };
  } catch (error) {
    return { ok: false, available: false, fullscreen: getBrowserFullscreenState(), error };
  }
}

export async function getCurrentFullscreenState() {
  if (!isDesktopRuntime()) return getBrowserFullscreenState();

  try {
    const { getCurrentWindow } = await loadTauriWindowApi();
    return await getCurrentWindow().isFullscreen();
  } catch {
    return getBrowserFullscreenState();
  }
}

export async function setCurrentWorkspaceFullscreen(enabled: boolean): Promise<WorkspaceFullscreenResult> {
  if (!isDesktopRuntime()) return setBrowserFullscreen(enabled);

  try {
    const { getCurrentWindow } = await loadTauriWindowApi();
    const currentWindow = getCurrentWindow();
    await currentWindow.setFullscreen(enabled);
    const fullscreen = await currentWindow.isFullscreen().catch(() => enabled);
    return { ok: true, available: true, fullscreen };
  } catch (error) {
    return { ok: false, available: false, fullscreen: await getCurrentFullscreenState(), error };
  }
}

export async function setAllOpenWorkspacesFullscreen(enabled: boolean): Promise<WorkspaceFullscreenResult> {
  if (!isDesktopRuntime()) {
    return { ok: false, available: false, fullscreen: getBrowserFullscreenState(), targetCount: 0 };
  }

  try {
    const { getAllWindows } = await loadTauriWindowApi();
    const workspaceWindows = (await getAllWindows()).filter((appWindow) => isWorkspaceWindowLabel(appWindow.label));
    const results = await Promise.allSettled(workspaceWindows.map((appWindow) => appWindow.setFullscreen(enabled)));
    const targetCount = workspaceWindows.length;
    const ok = targetCount > 0 && results.every((result) => result.status === 'fulfilled');

    return {
      ok,
      available: targetCount > 0,
      fullscreen: enabled,
      targetCount,
      error: ok ? undefined : results.find((result) => result.status === 'rejected'),
    };
  } catch (error) {
    return { ok: false, available: false, fullscreen: await getCurrentFullscreenState(), targetCount: 0, error };
  }
}

export function subscribeFullscreenState(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  let active = true;
  const unlisteners: Array<() => void> = [];
  const notify = () => {
    if (active) callback();
  };

  document.addEventListener('fullscreenchange', notify);
  window.addEventListener('focus', notify);
  window.addEventListener('resize', notify);
  document.addEventListener('visibilitychange', notify);

  if (isDesktopRuntime()) {
    void loadTauriWindowApi()
      .then(async ({ getCurrentWindow }) => {
        if (!active) return;

        const currentWindow = getCurrentWindow();
        const resizedUnlisten = await currentWindow.onResized?.(notify);
        const focusUnlisten = await currentWindow.onFocusChanged?.(notify);

        if (resizedUnlisten) unlisteners.push(resizedUnlisten);
        if (focusUnlisten) unlisteners.push(focusUnlisten);
      })
      .catch(() => undefined);
  }

  return () => {
    active = false;
    document.removeEventListener('fullscreenchange', notify);
    window.removeEventListener('focus', notify);
    window.removeEventListener('resize', notify);
    document.removeEventListener('visibilitychange', notify);
    unlisteners.forEach((unlisten) => unlisten());
  };
}
