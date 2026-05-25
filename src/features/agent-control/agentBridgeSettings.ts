import { readLocalStorageJson, writeLocalStorageJson } from '../workspace/browserStorage';
import { defaultAgentLocalBridgeUrl } from './agentControlModel';

const agentBridgeSettingsStorageKey = 'mission-control.agent-bridge-settings.v1';

export type AgentBridgeSettings = {
  localBridgeUrl: string;
  remoteApiUrl: string;
  updatedAt: string;
};

export function readAgentBridgeSettings(): AgentBridgeSettings {
  const parsed = readLocalStorageJson<Partial<AgentBridgeSettings>>(agentBridgeSettingsStorageKey);
  return {
    localBridgeUrl: typeof parsed?.localBridgeUrl === 'string' && parsed.localBridgeUrl.trim() ? parsed.localBridgeUrl : defaultAgentLocalBridgeUrl,
    remoteApiUrl: typeof parsed?.remoteApiUrl === 'string' ? parsed.remoteApiUrl : '',
    updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
  };
}

export function writeAgentBridgeSettings(settings: Pick<AgentBridgeSettings, 'localBridgeUrl' | 'remoteApiUrl'>) {
  const snapshot: AgentBridgeSettings = {
    localBridgeUrl: settings.localBridgeUrl.trim() || defaultAgentLocalBridgeUrl,
    remoteApiUrl: settings.remoteApiUrl.trim(),
    updatedAt: new Date().toISOString(),
  };
  writeLocalStorageJson(agentBridgeSettingsStorageKey, snapshot);
  return snapshot;
}
