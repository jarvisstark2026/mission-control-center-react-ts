import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import {
  getLocalAgentBridgeStatus,
  restartLocalAgentBridge,
  startLocalAgentBridge,
  stopLocalAgentBridge,
} from './localAgentBridgeProcess';

describe('localAgentBridgeProcess', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: undefined,
    });
  });

  it('reports the bundled bridge as unavailable in browser preview', async () => {
    const status = await getLocalAgentBridgeStatus('http://192.0.2.64:8642/v1');

    expect(status).toMatchObject({
      available: false,
      running: false,
      bridgeUrl: 'http://127.0.0.1:8787',
      hermesApiBaseUrl: 'http://192.0.2.64:8642/v1',
    });
    expect(status.lastError).toContain('Desktop app required');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('calls Tauri bridge commands when the desktop runtime is present', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    invokeMock.mockResolvedValue({
      available: true,
      running: true,
      bridgeUrl: 'http://127.0.0.1:8787',
      hermesApiBaseUrl: 'http://127.0.0.1:8642/v1',
    });

    await startLocalAgentBridge({ hermesApiBaseUrl: 'http://127.0.0.1:8642/v1', hermesModel: 'hermes-agent' });
    await restartLocalAgentBridge({ hermesApiBaseUrl: 'http://127.0.0.1:8642/v1', hermesModel: 'hermes-agent' });
    await stopLocalAgentBridge('http://127.0.0.1:8642/v1');

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'start_agent_bridge', {
      request: { hermesApiBaseUrl: 'http://127.0.0.1:8642/v1', hermesModel: 'hermes-agent' },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'restart_agent_bridge', {
      request: { hermesApiBaseUrl: 'http://127.0.0.1:8642/v1', hermesModel: 'hermes-agent' },
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, 'stop_agent_bridge');
  });
});
