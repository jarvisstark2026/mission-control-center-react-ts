import { invoke } from '@tauri-apps/api/core';

import { defaultAgentLocalBridgeUrl } from './agentControlModel';

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export type LocalAgentBridgeProcessState = {
  available: boolean;
  running: boolean;
  pid?: number;
  bridgeUrl: typeof defaultAgentLocalBridgeUrl;
  hermesApiBaseUrl: string;
  lastStartedAt?: string;
  lastError?: string;
};

export type StartLocalAgentBridgeInput = {
  hermesApiBaseUrl: string;
  hermesModel: string;
  hermesApiKey?: string;
  hermesApiKeyRef?: string;
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

function browserFallbackState(hermesApiBaseUrl = 'http://127.0.0.1:8642/v1'): LocalAgentBridgeProcessState {
  return {
    available: false,
    running: false,
    bridgeUrl: defaultAgentLocalBridgeUrl,
    hermesApiBaseUrl,
    lastError: 'Desktop app required to start the bundled local bridge.',
  };
}

export async function getLocalAgentBridgeStatus(hermesApiBaseUrl?: string): Promise<LocalAgentBridgeProcessState> {
  if (!isTauriRuntime()) return browserFallbackState(hermesApiBaseUrl);

  try {
    return await invoke<LocalAgentBridgeProcessState>('get_agent_bridge_status');
  } catch (error) {
    return {
      ...browserFallbackState(hermesApiBaseUrl),
      available: true,
      lastError: error instanceof Error ? error.message : 'Could not read local bridge process state.',
    };
  }
}

export async function startLocalAgentBridge(input: StartLocalAgentBridgeInput): Promise<LocalAgentBridgeProcessState> {
  if (!isTauriRuntime()) return browserFallbackState(input.hermesApiBaseUrl);
  return invoke<LocalAgentBridgeProcessState>('start_agent_bridge', { request: input });
}

export async function stopLocalAgentBridge(hermesApiBaseUrl?: string): Promise<LocalAgentBridgeProcessState> {
  if (!isTauriRuntime()) return browserFallbackState(hermesApiBaseUrl);
  return invoke<LocalAgentBridgeProcessState>('stop_agent_bridge');
}

export async function restartLocalAgentBridge(input: StartLocalAgentBridgeInput): Promise<LocalAgentBridgeProcessState> {
  if (!isTauriRuntime()) return browserFallbackState(input.hermesApiBaseUrl);
  return invoke<LocalAgentBridgeProcessState>('restart_agent_bridge', { request: input });
}
