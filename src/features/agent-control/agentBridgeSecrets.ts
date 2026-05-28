import { invoke } from '@tauri-apps/api/core';

export const hermesApiKeySecretRef = 'desktop-secret:hermes-api-key';

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export type AgentBridgeSecretResult = {
  available: boolean;
  keyRef: string;
  savedAt?: string;
  error?: string;
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export function isDesktopAgentSecretStoreAvailable() {
  return isTauriRuntime();
}

export async function writeAgentBridgeSecret(secret: string, keyRef = hermesApiKeySecretRef): Promise<AgentBridgeSecretResult> {
  if (!isTauriRuntime()) {
    return {
      available: false,
      keyRef,
      error: 'Desktop credential storage is available only in the installed Mission Control app.',
    };
  }

  return invoke<AgentBridgeSecretResult>('write_agent_bridge_secret', { keyRef, secret });
}

export async function readAgentBridgeSecret(keyRef = hermesApiKeySecretRef): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string | null>('read_agent_bridge_secret', { keyRef });
}

export async function deleteAgentBridgeSecret(keyRef = hermesApiKeySecretRef): Promise<AgentBridgeSecretResult> {
  if (!isTauriRuntime()) {
    return {
      available: false,
      keyRef,
      error: 'Desktop credential storage is available only in the installed Mission Control app.',
    };
  }

  return invoke<AgentBridgeSecretResult>('delete_agent_bridge_secret', { keyRef });
}
