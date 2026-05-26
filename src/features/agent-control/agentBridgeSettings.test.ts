import { beforeEach, describe, expect, it } from 'vitest';

import { defaultAgentLocalBridgeUrl } from './agentControlModel';
import { getHermesApiBaseUrlForMode, readAgentBridgeSettings, writeAgentBridgeSettings } from './agentBridgeSettings';

describe('agentBridgeSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('preserves old records without preferred agent fields', () => {
    window.localStorage.setItem(
      'mission-control.agent-bridge-settings.v1',
      JSON.stringify({
        localBridgeUrl: 'http://192.0.2.64:8787',
        remoteApiUrl: '',
        updatedAt: '2026-05-25T10:00:00.000Z',
      }),
    );

    const settings = readAgentBridgeSettings();

    expect(settings.localBridgeUrl).toBe('http://192.0.2.64:8787');
    expect(settings.bridgeMode).toBe('same-pc');
    expect(settings.hermesApiBaseUrl).toBe('http://127.0.0.1:8642/v1');
    expect(settings.preferredAgentId).toBeUndefined();
    expect(settings.lastSuccessfulUrl).toBeUndefined();
  });

  it('maps the three product connection modes to Hermes API URLs', () => {
    expect(getHermesApiBaseUrlForMode('same-pc')).toBe('http://127.0.0.1:8642/v1');
    expect(getHermesApiBaseUrlForMode('lan', '192.0.2.64')).toBe('http://192.0.2.64:8642/v1');
    expect(getHermesApiBaseUrlForMode('tailscale', 'http://198.51.100.119:8642/v1/status')).toBe('http://198.51.100.119:8642/v1');
  });

  it('merges preferred agent and last successful URL updates', () => {
    const first = writeAgentBridgeSettings({
      localBridgeUrl: 'http://192.0.2.64:8787',
      remoteApiUrl: '',
    });
    const second = writeAgentBridgeSettings({
      bridgeMode: 'lan',
      hermesHost: '192.0.2.64',
      preferredAgentId: 'hermes-bridge',
      lastSuccessfulUrl: 'http://192.0.2.64:8787',
    });

    expect(first.localBridgeUrl).toBe('http://192.0.2.64:8787');
    expect(second.localBridgeUrl).toBe('http://192.0.2.64:8787');
    expect(second.bridgeMode).toBe('lan');
    expect(second.hermesHost).toBe('192.0.2.64');
    expect(second.hermesApiBaseUrl).toBe('http://192.0.2.64:8642/v1');
    expect(second.preferredAgentId).toBe('hermes-bridge');
    expect(second.lastSuccessfulUrl).toBe('http://192.0.2.64:8787');
  });

  it('keeps the default bridge URL for empty local settings', () => {
    const settings = writeAgentBridgeSettings({ localBridgeUrl: '', remoteApiUrl: '' });

    expect(settings.localBridgeUrl).toBe(defaultAgentLocalBridgeUrl);
  });
});
