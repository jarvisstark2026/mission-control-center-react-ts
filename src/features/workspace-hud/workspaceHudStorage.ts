import { readLocalStorageJson, writeLocalStorageJson } from '../workspace/browserStorage';
import { workspacePersistenceChangeEventName, type WorkspacePersistenceChangeDetail } from '../workspace/workspacePersistence';
import type { WorkspaceHudColorMode, WorkspaceHudDesignId, WorkspaceHudSettings } from './workspaceHudTypes';

export const workspaceHudSettingsStorageKey = 'mission-control.workspace-hud-settings';

export const workspaceHudDesignOptions = [
  {
    id: 'orbital-core',
    label: 'Orbital Core',
    description: 'Balanced concentric telemetry with compact state lanes.',
  },
  {
    id: 'signal-halo',
    label: 'Signal Halo',
    description: 'Wide ring emphasis for voice and connection state.',
  },
  {
    id: 'network-aperture',
    label: 'Network Aperture',
    description: 'Node-forward view for integrations and workspace routing.',
  },
  {
    id: 'diagnostic-compass',
    label: 'Diagnostic Compass',
    description: 'Directional operations view for commands and alerts.',
  },
] as const satisfies readonly {
  id: WorkspaceHudDesignId;
  label: string;
  description: string;
}[];

export const workspaceHudColorOptions = [
  {
    id: 'theme',
    label: 'HUD default',
    description: 'Independent Mission Control HUD cyan with violet signal accents.',
  },
  {
    id: 'cyan-magenta',
    label: 'Cyan magenta',
    description: 'Cool primary with voice-reactive magenta highlights.',
  },
  {
    id: 'cyan-amber',
    label: 'Cyan amber',
    description: 'Current command-center contrast.',
  },
  {
    id: 'mono',
    label: 'Mono glass',
    description: 'Low-fatigue single-accent display.',
  },
] as const satisfies readonly {
  id: WorkspaceHudColorMode;
  label: string;
  description: string;
}[];

export const defaultWorkspaceHudSettings: WorkspaceHudSettings = {
  designId: 'signal-halo',
  colorMode: 'theme',
  centerHudVisible: true,
  voiceReactionEnabled: true,
  audioMeterEnabled: false,
};

function isWorkspaceHudDesignId(value: unknown): value is WorkspaceHudDesignId {
  return workspaceHudDesignOptions.some((option) => option.id === value);
}

function isWorkspaceHudColorMode(value: unknown): value is WorkspaceHudColorMode {
  return workspaceHudColorOptions.some((option) => option.id === value);
}

export function normalizeWorkspaceHudSettings(settings: Partial<WorkspaceHudSettings> | null | undefined): WorkspaceHudSettings {
  return {
    designId: isWorkspaceHudDesignId(settings?.designId) ? settings.designId : defaultWorkspaceHudSettings.designId,
    colorMode: isWorkspaceHudColorMode(settings?.colorMode) ? settings.colorMode : defaultWorkspaceHudSettings.colorMode,
    centerHudVisible:
      typeof settings?.centerHudVisible === 'boolean'
        ? settings.centerHudVisible
        : defaultWorkspaceHudSettings.centerHudVisible,
    voiceReactionEnabled:
      typeof settings?.voiceReactionEnabled === 'boolean'
        ? settings.voiceReactionEnabled
        : defaultWorkspaceHudSettings.voiceReactionEnabled,
    audioMeterEnabled:
      typeof settings?.audioMeterEnabled === 'boolean'
        ? settings.audioMeterEnabled
        : defaultWorkspaceHudSettings.audioMeterEnabled,
  };
}

export function readWorkspaceHudSettings(): WorkspaceHudSettings {
  return normalizeWorkspaceHudSettings(readLocalStorageJson<Partial<WorkspaceHudSettings>>(workspaceHudSettingsStorageKey));
}

export function writeWorkspaceHudSettings(settings: WorkspaceHudSettings) {
  return writeLocalStorageJson(workspaceHudSettingsStorageKey, normalizeWorkspaceHudSettings(settings));
}

export function areWorkspaceHudSettingsEqual(left: WorkspaceHudSettings, right: WorkspaceHudSettings) {
  return (
    left.designId === right.designId &&
    left.colorMode === right.colorMode &&
    left.centerHudVisible === right.centerHudVisible &&
    left.voiceReactionEnabled === right.voiceReactionEnabled &&
    left.audioMeterEnabled === right.audioMeterEnabled
  );
}

export function subscribeWorkspaceHudSettings(onSettingsChange: (settings: WorkspaceHudSettings) => void) {
  if (typeof window === 'undefined') return () => undefined;

  const resolveSettings = (value: unknown, allowStoredFallback: boolean) => {
    if (typeof value === 'string') {
      try {
        onSettingsChange(normalizeWorkspaceHudSettings(JSON.parse(value) as Partial<WorkspaceHudSettings>));
        return;
      } catch {
        // Fall through to the stored value when the event did not include parseable settings.
      }
    }

    if (allowStoredFallback) {
      onSettingsChange(readWorkspaceHudSettings());
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== workspaceHudSettingsStorageKey) return;
    resolveSettings(event.newValue, event.newValue === null);
  };

  const handlePersistenceChange = (event: Event) => {
    const detail = (event as CustomEvent<WorkspacePersistenceChangeDetail>).detail;
    if (detail?.key !== workspaceHudSettingsStorageKey) return;
    resolveSettings(detail.value, detail.value === undefined);
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(workspacePersistenceChangeEventName, handlePersistenceChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(workspacePersistenceChangeEventName, handlePersistenceChange);
  };
}
