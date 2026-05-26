import { readStorageText, writeStorageText } from '../workspace/browserStorage';

export const shellThemeOptions = [
  {
    id: 'jarvis',
    label: 'Forge Prime',
    description: 'Cyan glass, amber telemetry, and the current command center tone.',
  },
  {
    id: 'arc',
    label: 'Arc Reactor',
    description: 'Cooler blue signal layers with a sharper reactor glow.',
  },
  {
    id: 'ember',
    label: 'Mark IV Ember',
    description: 'Graphite glass with warm Stark lab highlights.',
  },
  {
    id: 'ghost',
    label: 'Ghost Protocol',
    description: 'Low-fatigue slate glass with restrained titanium accents.',
  },
] as const;

export type ShellThemeId = (typeof shellThemeOptions)[number]['id'];

export const defaultShellThemeId: ShellThemeId = 'jarvis';

const shellThemeStorageKey = 'mission-control-center-theme';

export function isShellThemeId(value: unknown): value is ShellThemeId {
  return typeof value === 'string' && shellThemeOptions.some((theme) => theme.id === value);
}

export function readStoredShellTheme(): ShellThemeId {
  try {
    const storedTheme = readStorageText(shellThemeStorageKey);
    return isShellThemeId(storedTheme) ? storedTheme : defaultShellThemeId;
  } catch {
    return defaultShellThemeId;
  }
}

export function applyShellTheme(themeId: ShellThemeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = themeId;
}

export function persistShellTheme(themeId: ShellThemeId) {
  try {
    writeStorageText(shellThemeStorageKey, themeId);
  } catch {
    // Theme persistence is optional; the active in-memory theme still applies.
  }
}
