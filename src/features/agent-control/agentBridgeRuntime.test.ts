import { describe, expect, it, vi } from 'vitest';

import type { MissionControlEvent } from '../mission-control';
import {
  applyAgentBridgeEvent,
  applyAgentBridgeStatus,
  createAgentBridgeTransport,
  isAgentBridgeStatusResponse,
  markAgentBridgeConnectorFailure,
  normalizeAgentBridgeEvent,
  selectAgentBridgeConnector,
} from './agentBridgeRuntime';
import { createInitialAgentControlState } from './agentControlModel';

function createNotificationEvent(): MissionControlEvent {
  return {
    type: 'notification',
    notification: {
      id: 'bridge-notification',
      level: 'notice',
      title: 'Bridge event',
      body: 'Hermes bridge emitted a notification.',
      source: 'agent-bridge',
      timestamp: '2026-05-25T12:00:00.000Z',
      acknowledged: false,
    },
  };
}

describe('agentBridgeRuntime', () => {
  it('selects local bridge over remote and mock when local is connected', () => {
    const initial = createInitialAgentControlState({ remoteApiUrl: 'https://agents.example.test' });
    const applied = applyAgentBridgeStatus(initial, 'hermes-local-bridge', {
      status: 'connected',
      provider: 'hermes',
      activeEngine: 'Hermes Core',
      capabilities: ['chat', 'tool-proposals'],
      missionControlEvents: [createNotificationEvent()],
    });

    const activeConnector = selectAgentBridgeConnector(applied.state);

    expect(activeConnector.id).toBe('hermes-local-bridge');
    expect(activeConnector.activeEngine).toBe('Hermes Core');
    expect(applied.missionControlEvents).toHaveLength(1);
  });

  it('uses remote bridge when local bridges are offline', () => {
    const initial = createInitialAgentControlState({ remoteApiUrl: 'https://agents.example.test' });
    const localFailed = markAgentBridgeConnectorFailure(initial, 'hermes-local-bridge', 'connection refused');
    const openClawFailed = markAgentBridgeConnectorFailure(localFailed, 'openclaw-local-bridge', 'connection refused');
    const applied = applyAgentBridgeStatus(openClawFailed, 'agent-remote-bridge', {
      status: 'connected',
      provider: 'custom',
      activeEngine: 'Hosted agent bridge',
    });

    expect(selectAgentBridgeConnector(applied.state).id).toBe('agent-remote-bridge');
  });

  it('falls back to mock when no bridge is connected or available', () => {
    const initial = createInitialAgentControlState();
    const localFailed = markAgentBridgeConnectorFailure(initial, 'hermes-local-bridge', 'connection refused');
    const openClawFailed = markAgentBridgeConnectorFailure(localFailed, 'openclaw-local-bridge', 'connection refused');

    expect(selectAgentBridgeConnector(openClawFailed).id).toBe('mock-agent-runtime');
  });

  it('normalizes valid bridge events and rejects malformed status payloads', () => {
    const event = createNotificationEvent();

    expect(isAgentBridgeStatusResponse({ status: 'connected', provider: 'hermes' })).toBe(true);
    expect(isAgentBridgeStatusResponse({ status: 'online', provider: 'hermes' })).toBe(false);
    expect(normalizeAgentBridgeEvent({ missionControlEvents: [event] })).toEqual({
      type: 'mission-events',
      events: [event],
    });
    expect(normalizeAgentBridgeEvent({ missionControlEvents: [{ type: 'command', command: { id: '' } }] })).toBeNull();
  });

  it('routes SSE mission events through the shared event path', () => {
    const initial = createInitialAgentControlState();
    const event = createNotificationEvent();
    const applied = applyAgentBridgeEvent(initial, 'hermes-local-bridge', {
      type: 'mission-events',
      events: [event],
    });

    expect(applied.state).toBe(initial);
    expect(applied.missionControlEvents).toEqual([event]);
  });

  it('fetches /status through the bridge transport', async () => {
    const connector = createInitialAgentControlState().connectors.find((item) => item.id === 'hermes-local-bridge');
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ status: 'connected', provider: 'hermes', activeEngine: 'Hermes Core' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    if (!connector) throw new Error('missing connector');

    const transport = createAgentBridgeTransport(connector, { fetchImpl });
    const result = await transport.checkStatus();

    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8787/status', {
      headers: { accept: 'application/json' },
    });
    expect(result.activeEngine).toBe('Hermes Core');
  });
});
