import { readLocalStorageJson, writeLocalStorageJson } from '../workspace/browserStorage';
import { defaultAgentLocalBridgeUrl } from './agentControlModel';

const agentBridgeSettingsStorageKey = 'mission-control.agent-bridge-settings.v1';
const defaultHermesApiPort = '8642';

export type AgentBridgeMode = 'same-pc' | 'lan' | 'tailscale';

export type AgentBridgeSettings = {
  localBridgeUrl: string;
  remoteApiUrl: string;
  bridgeMode?: AgentBridgeMode;
  hermesHost?: string;
  hermesApiBaseUrl?: string;
  hermesModel?: string;
  preferredAgentId?: string;
  lastSuccessfulUrl?: string;
  updatedAt: string;
};

export function isAgentBridgeMode(value: unknown): value is AgentBridgeMode {
  return value === 'same-pc' || value === 'lan' || value === 'tailscale';
}

function normalizeHost(value: unknown) {
  return typeof value === 'string'
    ? value
      .trim()
      .replace(/^https?:\/\//u, '')
      .replace(/\/.*$/u, '')
      .replace(/:\d+$/u, '')
    : '';
}

export function getHermesApiBaseUrlForMode(mode: AgentBridgeMode, host?: string) {
  if (mode === 'same-pc') return `http://127.0.0.1:${defaultHermesApiPort}/v1`;
  const normalizedHost = normalizeHost(host);
  return normalizedHost ? `http://${normalizedHost}:${defaultHermesApiPort}/v1` : '';
}

export function readAgentBridgeSettings(): AgentBridgeSettings {
  const parsed = readLocalStorageJson<Partial<AgentBridgeSettings>>(agentBridgeSettingsStorageKey);
  const bridgeMode = isAgentBridgeMode(parsed?.bridgeMode) ? parsed.bridgeMode : 'same-pc';
  const hermesHost = normalizeHost(parsed?.hermesHost);
  const derivedHermesApiBaseUrl = getHermesApiBaseUrlForMode(bridgeMode, hermesHost);
  return {
    localBridgeUrl: typeof parsed?.localBridgeUrl === 'string' && parsed.localBridgeUrl.trim() ? parsed.localBridgeUrl : defaultAgentLocalBridgeUrl,
    remoteApiUrl: typeof parsed?.remoteApiUrl === 'string' ? parsed.remoteApiUrl : '',
    bridgeMode,
    hermesHost,
    hermesApiBaseUrl: typeof parsed?.hermesApiBaseUrl === 'string' && parsed.hermesApiBaseUrl.trim() ? parsed.hermesApiBaseUrl : derivedHermesApiBaseUrl,
    hermesModel: typeof parsed?.hermesModel === 'string' && parsed.hermesModel.trim() ? parsed.hermesModel : 'hermes-agent',
    preferredAgentId: typeof parsed?.preferredAgentId === 'string' ? parsed.preferredAgentId : undefined,
    lastSuccessfulUrl: typeof parsed?.lastSuccessfulUrl === 'string' ? parsed.lastSuccessfulUrl : undefined,
    updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
  };
}

export function writeAgentBridgeSettings(settings: Partial<Pick<AgentBridgeSettings, 'localBridgeUrl' | 'remoteApiUrl' | 'bridgeMode' | 'hermesHost' | 'hermesApiBaseUrl' | 'hermesModel' | 'preferredAgentId' | 'lastSuccessfulUrl'>>) {
  const current = readAgentBridgeSettings();
  const bridgeMode = isAgentBridgeMode(settings.bridgeMode) ? settings.bridgeMode : current.bridgeMode ?? 'same-pc';
  const hermesHost = typeof settings.hermesHost === 'string' ? normalizeHost(settings.hermesHost) : current.hermesHost;
  const hermesApiBaseUrl = typeof settings.hermesApiBaseUrl === 'string' && settings.hermesApiBaseUrl.trim()
    ? settings.hermesApiBaseUrl.trim()
    : getHermesApiBaseUrlForMode(bridgeMode, hermesHost);
  const snapshot: AgentBridgeSettings = {
    localBridgeUrl: settings.localBridgeUrl?.trim() || current.localBridgeUrl || defaultAgentLocalBridgeUrl,
    remoteApiUrl: typeof settings.remoteApiUrl === 'string' ? settings.remoteApiUrl.trim() : current.remoteApiUrl,
    bridgeMode,
    hermesHost,
    hermesApiBaseUrl,
    hermesModel: typeof settings.hermesModel === 'string' && settings.hermesModel.trim() ? settings.hermesModel.trim() : current.hermesModel ?? 'hermes-agent',
    preferredAgentId: typeof settings.preferredAgentId === 'string' ? settings.preferredAgentId : current.preferredAgentId,
    lastSuccessfulUrl: typeof settings.lastSuccessfulUrl === 'string' ? settings.lastSuccessfulUrl : current.lastSuccessfulUrl,
    updatedAt: new Date().toISOString(),
  };
  writeLocalStorageJson(agentBridgeSettingsStorageKey, snapshot);
  return snapshot;
}
