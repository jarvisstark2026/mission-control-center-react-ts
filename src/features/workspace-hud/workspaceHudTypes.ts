import type { AgentConnectionState, AgentControlState } from '../agent-control';
import type {
  MissionControlConnectionState,
  MissionControlSeverity,
  TelemetryChannel,
} from '../mission-control/missionControlTypes';
import type { ShellRole } from '../shell/roles';

export type WorkspaceHudDesignId = 'orbital-core' | 'signal-halo' | 'network-aperture' | 'diagnostic-compass';

export type WorkspaceHudColorMode = 'theme' | 'cyan-magenta' | 'cyan-amber' | 'mono';

export type WorkspaceHudSettings = {
  designId: WorkspaceHudDesignId;
  colorMode: WorkspaceHudColorMode;
  voiceReactionEnabled: boolean;
  audioMeterEnabled: boolean;
};

export type WorkspaceHudMetric = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  severity: MissionControlSeverity;
};

export type WorkspaceHudTelemetrySignal = {
  id: string;
  channel: TelemetryChannel;
  label: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
  severity: MissionControlSeverity;
  timestamp: string;
};

export type WorkspaceHudAgentSignal = {
  name: string;
  status: AgentControlState['identity']['status'];
  connection: AgentConnectionState;
  profile: string;
  model: string;
};

export type WorkspaceHudSignals = {
  sourceLabel: string;
  connection: MissionControlConnectionState;
  role: ShellRole;
  activeModeLabel: string;
  workspaceOnCount: number;
  widgetOpenCount: number;
  pendingCommands: number;
  activeCommands: number;
  unacknowledgedNotifications: number;
  highestNotificationSeverity: MissionControlSeverity;
  integrationHealth: {
    online: number;
    degraded: number;
    offline: number;
  };
  agent: WorkspaceHudAgentSignal;
  telemetry: WorkspaceHudTelemetrySignal[];
  metrics: WorkspaceHudMetric[];
  lastUpdatedAt: string;
};

export type AgentVoiceStatus = 'idle' | 'speaking' | 'listening' | 'error';

export type AgentVoiceSource = 'local' | 'web-speech' | 'agent' | 'microphone' | 'unavailable';

export type AgentVoiceTransientEvent = {
  level: number;
  age: number;
  angle: number;
};

export type AgentVoiceInstrument = {
  waveformRing: number[];
  spectrumWheel: number[];
  bassRing: number[];
  midRing: number[];
  highRing: number[];
  transientEvents: AgentVoiceTransientEvent[];
};

export type AgentVoiceState = {
  enabled: boolean;
  status: AgentVoiceStatus;
  level: number;
  source: AgentVoiceSource;
  amplitude: number | null;
  dominantFrequencyHz: number | null;
  wavelengthMeters: number | null;
  spectralCentroidHz: number | null;
  peakLevel: number;
  transientLevel: number;
  bandLevels: {
    sub: number;
    bass: number;
    lowMid: number;
    mid: number;
    presence: number;
    brilliance: number;
  };
  waveform: number[];
  frequencyBins: number[];
  history: number[];
  instrument: AgentVoiceInstrument;
  spectrum: number[];
};

export type AgentVoiceEventDetail = {
  status?: AgentVoiceStatus;
  level?: number;
  amplitude?: number;
  dominantFrequencyHz?: number;
  wavelengthMeters?: number;
  spectralCentroidHz?: number;
  peakLevel?: number;
  transientLevel?: number;
  bandLevels?: Partial<AgentVoiceState['bandLevels']>;
  waveform?: number[];
  frequencyBins?: number[];
  history?: number[];
  instrument?: Partial<AgentVoiceInstrument>;
  spectrum?: number[];
  source?: AgentVoiceSource;
};
