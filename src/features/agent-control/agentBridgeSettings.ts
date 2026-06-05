import { readLocalStorageJson, readStorageText, writeLocalStorageJson } from '../workspace/browserStorage';
import { defaultAgentLocalBridgeUrl } from './agentControlModel';

const agentBridgeSettingsStorageKey = 'mission-control.agent-bridge-settings.v1';
const defaultHermesApiPort = '8642';

type AgentBridgeImportMetaEnv = ImportMetaEnv & {
  readonly VITE_AGENT_LOCAL_BRIDGE_URL?: string;
  readonly VITE_HERMES_BRIDGE_MODE?: string;
  readonly VITE_HERMES_HOST?: string;
  readonly VITE_HERMES_API_SCHEME?: string;
  readonly VITE_HERMES_API_PORT?: string;
  readonly VITE_HERMES_MODEL?: string;
};

export type AgentBridgeMode = 'same-pc' | 'lan' | 'tailscale';
export type HermesApiScheme = 'http' | 'https';

export type AgentBridgeSettings = {
  localBridgeUrl: string;
  remoteApiUrl: string;
  bridgeMode?: AgentBridgeMode;
  hermesHost?: string;
  hermesApiScheme?: HermesApiScheme;
  hermesApiPort?: string;
  hermesApiKey?: string;
  hermesApiKeyRef?: string;
  hasHermesApiKey?: boolean;
  hermesApiBaseUrl?: string;
  hermesModel?: string;
  voiceTranscriptionUrl?: string;
  voiceTranscriptionModel?: string;
  voiceTranscriptionApiKey?: string;
  voiceTranscriptionApiKeyRef?: string;
  hasVoiceTranscriptionApiKey?: boolean;
  voiceTranscriptionTimeoutMs?: number;
  voiceTranscriptionMimeTypes?: string[];
  preferredAgentId?: string;
  lastSuccessfulUrl?: string;
  updatedAt: string;
};

export function isAgentBridgeMode(value: unknown): value is AgentBridgeMode {
  return value === 'same-pc' || value === 'lan' || value === 'tailscale';
}

function normalizeHost(value: unknown) {
  return getHostAndPort(value).host;
}

function normalizeScheme(value: unknown): HermesApiScheme {
  return value === 'https' ? 'https' : 'http';
}

function normalizePortDigits(value: unknown, fallback = defaultHermesApiPort) {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const text = String(value).trim();
  if (!/^\d{1,5}$/u.test(text)) return fallback;
  const port = Number(text);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? String(port) : fallback;
}

function getHostAndPort(value: unknown): { host: string; port?: string } {
  if (typeof value !== 'string') return { host: '', port: undefined };
  const hostPort = value
    .trim()
    .replace(/^https?:\/\//u, '')
    .replace(/\/.*$/u, '');
  const portMatch = hostPort.match(/:(\d{1,5})$/u);
  const port = portMatch ? normalizePortDigits(portMatch[1], '') : undefined;
  const host = hostPort.replace(/:\d{1,5}$/u, '');
  return { host, port: port || undefined };
}

function normalizeHermesApiPort(value: unknown, fallback = defaultHermesApiPort) {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const text = String(value).trim();
  return getHostAndPort(text).port ?? normalizePortDigits(text, fallback);
}

function getAgentBridgeEnvDefaults() {
  const env = import.meta.env as AgentBridgeImportMetaEnv;
  const bridgeMode = isAgentBridgeMode(env.VITE_HERMES_BRIDGE_MODE) ? env.VITE_HERMES_BRIDGE_MODE : 'same-pc';
  const hostInput = typeof env.VITE_HERMES_HOST === 'string' ? env.VITE_HERMES_HOST : '';
  const parsedHost = getHostAndPort(hostInput);
  const hermesApiScheme = normalizeScheme(env.VITE_HERMES_API_SCHEME ?? (hostInput.trim().startsWith('https://') ? 'https' : 'http'));
  const hermesApiPort = normalizeHermesApiPort(env.VITE_HERMES_API_PORT ?? parsedHost.port);
  const hermesHost = normalizeHost(hostInput);
  const hermesApiBaseUrl = getHermesApiBaseUrlForModeAndScheme(bridgeMode, hermesHost, hermesApiPort, hermesApiScheme);

  return {
    localBridgeUrl: typeof env.VITE_AGENT_LOCAL_BRIDGE_URL === 'string' && env.VITE_AGENT_LOCAL_BRIDGE_URL.trim()
      ? env.VITE_AGENT_LOCAL_BRIDGE_URL.trim()
      : defaultAgentLocalBridgeUrl,
    bridgeMode,
    hermesHost,
    hermesApiScheme,
    hermesApiPort,
    hermesApiBaseUrl,
    hermesModel: typeof env.VITE_HERMES_MODEL === 'string' && env.VITE_HERMES_MODEL.trim() ? env.VITE_HERMES_MODEL.trim() : 'hermes-agent',
  };
}

export function getHermesApiBaseUrlForMode(mode: AgentBridgeMode, host?: string, port?: string) {
  return getHermesApiBaseUrlForModeAndScheme(mode, host, port, 'http');
}

export function getHermesApiBaseUrlForModeAndScheme(mode: AgentBridgeMode, host?: string, port?: string, scheme: HermesApiScheme = 'http') {
  const parsedHost = getHostAndPort(host);
  const hermesApiPort = normalizeHermesApiPort(port ?? parsedHost.port);
  if (mode === 'same-pc') return `${scheme}://127.0.0.1:${hermesApiPort}/v1`;
  const normalizedHost = normalizeHost(host);
  return normalizedHost ? `${scheme}://${normalizedHost}:${hermesApiPort}/v1` : '';
}

export function readAgentBridgeSettings(): AgentBridgeSettings {
  const hasSavedSettings = Boolean(readStorageText(agentBridgeSettingsStorageKey));
  const parsed = readLocalStorageJson<Partial<AgentBridgeSettings>>(agentBridgeSettingsStorageKey);
  const envDefaults = hasSavedSettings
    ? {
        localBridgeUrl: defaultAgentLocalBridgeUrl,
        bridgeMode: 'same-pc' as AgentBridgeMode,
        hermesHost: '',
        hermesApiScheme: 'http' as HermesApiScheme,
        hermesApiPort: defaultHermesApiPort,
        hermesApiBaseUrl: 'http://127.0.0.1:8642/v1',
        hermesModel: 'hermes-agent',
      }
    : getAgentBridgeEnvDefaults();
  const bridgeMode = isAgentBridgeMode(parsed?.bridgeMode) ? parsed.bridgeMode : envDefaults.bridgeMode;
  const parsedEndpoint = getHostAndPort(parsed?.hermesApiBaseUrl);
  const hermesApiScheme = normalizeScheme(parsed?.hermesApiScheme ?? (typeof parsed?.hermesApiBaseUrl === 'string' && parsed.hermesApiBaseUrl.startsWith('https://') ? 'https' : envDefaults.hermesApiScheme));
  const hermesHost = normalizeHost(parsed?.hermesHost) || (bridgeMode === 'same-pc' ? '' : parsedEndpoint.host || envDefaults.hermesHost);
  const hermesApiPort = normalizeHermesApiPort(parsed?.hermesApiPort ?? parsedEndpoint.port, envDefaults.hermesApiPort);
  const derivedHermesApiBaseUrl = getHermesApiBaseUrlForModeAndScheme(bridgeMode, hermesHost, hermesApiPort, hermesApiScheme);
  return {
    localBridgeUrl: typeof parsed?.localBridgeUrl === 'string' && parsed.localBridgeUrl.trim() ? parsed.localBridgeUrl : envDefaults.localBridgeUrl,
    remoteApiUrl: typeof parsed?.remoteApiUrl === 'string' ? parsed.remoteApiUrl : '',
    bridgeMode,
    hermesHost,
    hermesApiScheme,
    hermesApiPort,
    hermesApiKey: typeof parsed?.hermesApiKey === 'string' && parsed.hermesApiKey.trim() ? parsed.hermesApiKey : undefined,
    hermesApiKeyRef: typeof parsed?.hermesApiKeyRef === 'string' && parsed.hermesApiKeyRef.trim() ? parsed.hermesApiKeyRef : undefined,
    hasHermesApiKey: Boolean(parsed?.hasHermesApiKey || (typeof parsed?.hermesApiKey === 'string' && parsed.hermesApiKey.trim()) || (typeof parsed?.hermesApiKeyRef === 'string' && parsed.hermesApiKeyRef.trim())),
    hermesApiBaseUrl: derivedHermesApiBaseUrl,
    hermesModel: typeof parsed?.hermesModel === 'string' && parsed.hermesModel.trim() ? parsed.hermesModel : envDefaults.hermesModel,
    voiceTranscriptionUrl: typeof parsed?.voiceTranscriptionUrl === 'string' && parsed.voiceTranscriptionUrl.trim() ? parsed.voiceTranscriptionUrl.trim() : undefined,
    voiceTranscriptionModel: typeof parsed?.voiceTranscriptionModel === 'string' && parsed.voiceTranscriptionModel.trim() ? parsed.voiceTranscriptionModel.trim() : undefined,
    voiceTranscriptionApiKey: typeof parsed?.voiceTranscriptionApiKey === 'string' && parsed.voiceTranscriptionApiKey.trim() ? parsed.voiceTranscriptionApiKey : undefined,
    voiceTranscriptionApiKeyRef: typeof parsed?.voiceTranscriptionApiKeyRef === 'string' && parsed.voiceTranscriptionApiKeyRef.trim() ? parsed.voiceTranscriptionApiKeyRef : undefined,
    hasVoiceTranscriptionApiKey: Boolean(parsed?.hasVoiceTranscriptionApiKey || (typeof parsed?.voiceTranscriptionApiKey === 'string' && parsed.voiceTranscriptionApiKey.trim()) || (typeof parsed?.voiceTranscriptionApiKeyRef === 'string' && parsed.voiceTranscriptionApiKeyRef.trim())),
    voiceTranscriptionTimeoutMs: typeof parsed?.voiceTranscriptionTimeoutMs === 'number' && Number.isFinite(parsed.voiceTranscriptionTimeoutMs) ? parsed.voiceTranscriptionTimeoutMs : 20000,
    voiceTranscriptionMimeTypes: Array.isArray(parsed?.voiceTranscriptionMimeTypes)
      ? parsed.voiceTranscriptionMimeTypes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4'],
    preferredAgentId: typeof parsed?.preferredAgentId === 'string' ? parsed.preferredAgentId : undefined,
    lastSuccessfulUrl: typeof parsed?.lastSuccessfulUrl === 'string' ? parsed.lastSuccessfulUrl : undefined,
    updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
  };
}

export function writeAgentBridgeSettings(settings: Partial<Pick<AgentBridgeSettings, 'localBridgeUrl' | 'remoteApiUrl' | 'bridgeMode' | 'hermesHost' | 'hermesApiScheme' | 'hermesApiPort' | 'hermesApiKey' | 'hermesApiKeyRef' | 'hasHermesApiKey' | 'hermesApiBaseUrl' | 'hermesModel' | 'voiceTranscriptionUrl' | 'voiceTranscriptionModel' | 'voiceTranscriptionApiKey' | 'voiceTranscriptionApiKeyRef' | 'hasVoiceTranscriptionApiKey' | 'voiceTranscriptionTimeoutMs' | 'voiceTranscriptionMimeTypes' | 'preferredAgentId' | 'lastSuccessfulUrl'>>) {
  const current = readAgentBridgeSettings();
  const bridgeMode = isAgentBridgeMode(settings.bridgeMode) ? settings.bridgeMode : current.bridgeMode ?? 'same-pc';
  const hostInput = typeof settings.hermesHost === 'string' ? settings.hermesHost : current.hermesHost;
  const parsedHost = getHostAndPort(hostInput);
  const hermesHost = normalizeHost(hostInput);
  const hermesApiScheme = normalizeScheme(settings.hermesApiScheme ?? (typeof hostInput === 'string' && hostInput.trim().startsWith('https://') ? 'https' : current.hermesApiScheme));
  const hermesApiPort = normalizeHermesApiPort(settings.hermesApiPort ?? parsedHost.port ?? current.hermesApiPort);
  const hermesApiBaseUrl = getHermesApiBaseUrlForModeAndScheme(bridgeMode, hermesHost, hermesApiPort, hermesApiScheme);
  const snapshot: AgentBridgeSettings = {
    localBridgeUrl: settings.localBridgeUrl?.trim() || current.localBridgeUrl || defaultAgentLocalBridgeUrl,
    remoteApiUrl: typeof settings.remoteApiUrl === 'string' ? settings.remoteApiUrl.trim() : current.remoteApiUrl,
    bridgeMode,
    hermesHost,
    hermesApiScheme,
    hermesApiPort,
    hermesApiKey: typeof settings.hermesApiKey === 'string' && settings.hermesApiKey.trim() ? settings.hermesApiKey.trim() : undefined,
    hermesApiKeyRef: typeof settings.hermesApiKeyRef === 'string' && settings.hermesApiKeyRef.trim() ? settings.hermesApiKeyRef.trim() : current.hermesApiKeyRef,
    hasHermesApiKey: typeof settings.hasHermesApiKey === 'boolean'
      ? settings.hasHermesApiKey
      : Boolean((typeof settings.hermesApiKey === 'string' && settings.hermesApiKey.trim()) || current.hasHermesApiKey),
    hermesApiBaseUrl,
    hermesModel: typeof settings.hermesModel === 'string' && settings.hermesModel.trim() ? settings.hermesModel.trim() : current.hermesModel ?? 'hermes-agent',
    voiceTranscriptionUrl: typeof settings.voiceTranscriptionUrl === 'string' ? settings.voiceTranscriptionUrl.trim() || undefined : current.voiceTranscriptionUrl,
    voiceTranscriptionModel: typeof settings.voiceTranscriptionModel === 'string' ? settings.voiceTranscriptionModel.trim() || undefined : current.voiceTranscriptionModel,
    voiceTranscriptionApiKey: typeof settings.voiceTranscriptionApiKey === 'string' && settings.voiceTranscriptionApiKey.trim() ? settings.voiceTranscriptionApiKey.trim() : undefined,
    voiceTranscriptionApiKeyRef: typeof settings.voiceTranscriptionApiKeyRef === 'string' && settings.voiceTranscriptionApiKeyRef.trim() ? settings.voiceTranscriptionApiKeyRef.trim() : current.voiceTranscriptionApiKeyRef,
    hasVoiceTranscriptionApiKey: typeof settings.hasVoiceTranscriptionApiKey === 'boolean'
      ? settings.hasVoiceTranscriptionApiKey
      : Boolean((typeof settings.voiceTranscriptionApiKey === 'string' && settings.voiceTranscriptionApiKey.trim()) || current.hasVoiceTranscriptionApiKey),
    voiceTranscriptionTimeoutMs: typeof settings.voiceTranscriptionTimeoutMs === 'number' && Number.isFinite(settings.voiceTranscriptionTimeoutMs)
      ? Math.max(1000, Math.min(120000, Math.round(settings.voiceTranscriptionTimeoutMs)))
      : current.voiceTranscriptionTimeoutMs ?? 20000,
    voiceTranscriptionMimeTypes: Array.isArray(settings.voiceTranscriptionMimeTypes)
      ? settings.voiceTranscriptionMimeTypes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : current.voiceTranscriptionMimeTypes,
    preferredAgentId: typeof settings.preferredAgentId === 'string' ? settings.preferredAgentId : current.preferredAgentId,
    lastSuccessfulUrl: typeof settings.lastSuccessfulUrl === 'string' ? settings.lastSuccessfulUrl : current.lastSuccessfulUrl,
    updatedAt: new Date().toISOString(),
  };
  writeLocalStorageJson(agentBridgeSettingsStorageKey, snapshot);
  return snapshot;
}
