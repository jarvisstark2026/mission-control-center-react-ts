import { readLocalStorageJson, writeLocalStorageJson } from '../workspace/browserStorage';
import type { WorkspaceHudColorMode, WorkspaceHudDesignId, WorkspaceHudSettings } from './workspaceHudTypes';

const workspaceHudSettingsStorageKey = 'mission-control.workspace-hud-settings';

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
    label: 'Theme linked',
    description: 'Use the active app theme accents.',
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
