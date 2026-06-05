import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultAgentLocalBridgeUrl } from './agentControlModel';
import { getHermesApiBaseUrlForMode, getHermesApiBaseUrlForModeAndScheme, readAgentBridgeSettings, writeAgentBridgeSettings } from './agentBridgeSettings';

describe('agentBridgeSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads non-secret Hermes defaults from env when no local settings are saved', () => {
    vi.stubEnv('VITE_HERMES_BRIDGE_MODE', 'tailscale');
    vi.stubEnv('VITE_HERMES_HOST', '100.64.0.10');
    vi.stubEnv('VITE_HERMES_API_PORT', '8642');
    vi.stubEnv('VITE_HERMES_API_SCHEME', 'http');
    vi.stubEnv('VITE_HERMES_MODEL', 'hermes-agent');
    vi.stubEnv('VITE_AGENT_LOCAL_BRIDGE_URL', 'http://127.0.0.1:8787');
    vi.stubEnv('VITE_HERMES_API_KEY', 'must-not-be-read');

    const settings = readAgentBridgeSettings();

    expect(settings.bridgeMode).toBe('tailscale');
    expect(settings.hermesHost).toBe('100.64.0.10');
    expect(settings.hermesApiPort).toBe('8642');
    expect(settings.hermesApiScheme).toBe('http');
    expect(settings.hermesModel).toBe('hermes-agent');
    expect(settings.localBridgeUrl).toBe(defaultAgentLocalBridgeUrl);
    expect(settings.hermesApiBaseUrl).toBe('http://100.64.0.10:8642/v1');
    expect(settings.hermesApiKey).toBeUndefined();
    expect(settings.hasHermesApiKey).toBe(false);
  });

  it('keeps saved settings ahead of env defaults', () => {
    vi.stubEnv('VITE_HERMES_BRIDGE_MODE', 'tailscale');
    vi.stubEnv('VITE_HERMES_HOST', '100.64.0.10');
    vi.stubEnv('VITE_HERMES_API_PORT', '8642');
    vi.stubEnv('VITE_HERMES_MODEL', 'hermes-agent');
    window.localStorage.setItem(
      'mission-control.agent-bridge-settings.v1',
      JSON.stringify({
        bridgeMode: 'lan',
        hermesHost: '192.168.1.20',
        hermesApiPort: '8445',
        hermesModel: 'custom-agent',
        localBridgeUrl: 'http://127.0.0.1:8787',
        remoteApiUrl: '',
        updatedAt: '2026-05-25T10:00:00.000Z',
      }),
    );

    const settings = readAgentBridgeSettings();

    expect(settings.bridgeMode).toBe('lan');
    expect(settings.hermesHost).toBe('192.168.1.20');
    expect(settings.hermesApiPort).toBe('8445');
    expect(settings.hermesModel).toBe('custom-agent');
    expect(settings.hermesApiBaseUrl).toBe('http://192.168.1.20:8445/v1');
  });

  it('preserves old records without preferred agent fields', () => {
    window.localStorage.setItem(
      'mission-control.agent-bridge-settings.v1',
      JSON.stringify({
        localBridgeUrl: 'http://192.168.1.20:8787',
        remoteApiUrl: '',
        updatedAt: '2026-05-25T10:00:00.000Z',
      }),
    );

    const settings = readAgentBridgeSettings();

    expect(settings.localBridgeUrl).toBe('http://192.168.1.20:8787');
    expect(settings.bridgeMode).toBe('same-pc');
    expect(settings.hermesApiPort).toBe('8642');
    expect(settings.hermesApiKey).toBeUndefined();
    expect(settings.hasHermesApiKey).toBe(false);
    expect(settings.hermesApiBaseUrl).toBe('http://127.0.0.1:8642/v1');
    expect(settings.preferredAgentId).toBeUndefined();
    expect(settings.lastSuccessfulUrl).toBeUndefined();
  });

  it('maps the three product connection modes to Hermes API URLs', () => {
    expect(getHermesApiBaseUrlForMode('same-pc')).toBe('http://127.0.0.1:8642/v1');
    expect(getHermesApiBaseUrlForMode('lan', '192.168.1.20')).toBe('http://192.168.1.20:8642/v1');
    expect(getHermesApiBaseUrlForMode('tailscale', 'http://100.64.0.10:8642/v1/status')).toBe('http://100.64.0.10:8642/v1');
    expect(getHermesApiBaseUrlForMode('lan', '192.168.1.20', '8445')).toBe('http://192.168.1.20:8445/v1');
    expect(getHermesApiBaseUrlForMode('tailscale', 'http://100.64.0.10:8446/v1/status')).toBe('http://100.64.0.10:8446/v1');
    expect(getHermesApiBaseUrlForModeAndScheme('lan', '192.168.1.20', '8642', 'https')).toBe('https://192.168.1.20:8642/v1');
  });

  it('preserves custom Hermes API port settings', () => {
    const settings = writeAgentBridgeSettings({
      bridgeMode: 'lan',
      hermesHost: '192.168.1.20',
      hermesApiPort: '8445',
    });

    expect(settings.hermesHost).toBe('192.168.1.20');
    expect(settings.hermesApiPort).toBe('8445');
    expect(settings.hermesApiBaseUrl).toBe('http://192.168.1.20:8445/v1');
  });

  it('persists Hermes API key settings locally', () => {
    const settings = writeAgentBridgeSettings({
      bridgeMode: 'lan',
      hermesHost: '192.168.1.20',
      hermesApiPort: '8642',
      hermesApiKey: ' test-secret ',
    });

    expect(settings.hermesApiKey).toBe('test-secret');
    expect(settings.hasHermesApiKey).toBe(true);
    expect(readAgentBridgeSettings().hermesApiKey).toBe('test-secret');
  });

  it('stores desktop secret references without keeping the raw key', () => {
    const settings = writeAgentBridgeSettings({
      bridgeMode: 'lan',
      hermesHost: '192.168.1.20',
      hermesApiKeyRef: 'desktop-secret:hermes-api-key',
      hasHermesApiKey: true,
      hermesApiKey: '',
    });

    expect(settings.hermesApiKey).toBeUndefined();
    expect(settings.hermesApiKeyRef).toBe('desktop-secret:hermes-api-key');
    expect(readAgentBridgeSettings().hasHermesApiKey).toBe(true);
  });

  it('persists voice transcription bridge settings and secret references', () => {
    const settings = writeAgentBridgeSettings({
      voiceTranscriptionUrl: ' https://voice.example.test/transcribe ',
      voiceTranscriptionModel: ' whisper-large ',
      voiceTranscriptionApiKeyRef: 'desktop-secret:hermes-voice-api-key',
      hasVoiceTranscriptionApiKey: true,
      voiceTranscriptionApiKey: '',
      voiceTranscriptionTimeoutMs: 45000,
      voiceTranscriptionMimeTypes: ['audio/webm', 'audio/wav'],
    });

    expect(settings.voiceTranscriptionUrl).toBe('https://voice.example.test/transcribe');
    expect(settings.voiceTranscriptionModel).toBe('whisper-large');
    expect(settings.voiceTranscriptionApiKey).toBeUndefined();
    expect(settings.voiceTranscriptionApiKeyRef).toBe('desktop-secret:hermes-voice-api-key');
    expect(settings.hasVoiceTranscriptionApiKey).toBe(true);
    expect(settings.voiceTranscriptionTimeoutMs).toBe(45000);
    expect(readAgentBridgeSettings().voiceTranscriptionMimeTypes).toEqual(['audio/webm', 'audio/wav']);
  });

  it('extracts host and port from a pasted Hermes URL', () => {
    const settings = writeAgentBridgeSettings({
      bridgeMode: 'lan',
      hermesHost: 'https://192.168.1.20:8446/v1/models',
    });

    expect(settings.hermesHost).toBe('192.168.1.20');
    expect(settings.hermesApiScheme).toBe('https');
    expect(settings.hermesApiPort).toBe('8446');
    expect(settings.hermesApiBaseUrl).toBe('https://192.168.1.20:8446/v1');
  });

  it('merges preferred agent and last successful URL updates', () => {
    const first = writeAgentBridgeSettings({
      localBridgeUrl: 'http://192.168.1.20:8787',
      remoteApiUrl: '',
    });
    const second = writeAgentBridgeSettings({
      bridgeMode: 'lan',
      hermesHost: '192.168.1.20',
      preferredAgentId: 'hermes-bridge',
      lastSuccessfulUrl: 'http://192.168.1.20:8787',
    });

    expect(first.localBridgeUrl).toBe('http://192.168.1.20:8787');
    expect(second.localBridgeUrl).toBe('http://192.168.1.20:8787');
    expect(second.bridgeMode).toBe('lan');
    expect(second.hermesHost).toBe('192.168.1.20');
    expect(second.hermesApiPort).toBe('8642');
    expect(second.hermesApiBaseUrl).toBe('http://192.168.1.20:8642/v1');
    expect(second.preferredAgentId).toBe('hermes-bridge');
    expect(second.lastSuccessfulUrl).toBe('http://192.168.1.20:8787');
  });

  it('keeps the default bridge URL for empty local settings', () => {
    const settings = writeAgentBridgeSettings({ localBridgeUrl: '', remoteApiUrl: '' });

    expect(settings.localBridgeUrl).toBe(defaultAgentLocalBridgeUrl);
  });
});
