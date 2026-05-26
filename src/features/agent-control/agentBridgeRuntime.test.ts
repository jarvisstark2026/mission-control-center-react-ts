import { describe, expect, it, vi } from 'vitest';

import type { MissionControlEvent } from '../mission-control';
import {
  applyAgentBridgeEvent,
  applyAgentBridgeStatus,
  createAgentBridgeTransport,
  isAgentBridgeStatusResponse,
  markAgentBridgeConnectorFailure,
  normalizeAgentBridgeStatusResponse,
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

  it('keeps a local available bridge ahead of a connected remote bridge', () => {
    const initial = createInitialAgentControlState({ remoteApiUrl: 'https://agents.example.test' });
    const remoteConnected = applyAgentBridgeStatus(initial, 'agent-remote-bridge', {
      status: 'connected',
      provider: 'custom',
      activeEngine: 'Hosted agent bridge',
    });
    const localAvailable = applyAgentBridgeStatus(remoteConnected.state, 'hermes-local-bridge', {
      status: 'available',
      provider: 'hermes',
      activeEngine: 'Hermes local bridge',
    });

    expect(selectAgentBridgeConnector(localAvailable.state).id).toBe('hermes-local-bridge');
  });

  it('falls back to mock when no bridge is connected or available', () => {
    const initial = createInitialAgentControlState();
    const localFailed = markAgentBridgeConnectorFailure(initial, 'hermes-local-bridge', 'connection refused');
    const openClawFailed = markAgentBridgeConnectorFailure(localFailed, 'openclaw-local-bridge', 'connection refused');

    expect(selectAgentBridgeConnector(openClawFailed).id).toBe('mock-agent-runtime');
  });

  it('keeps a reachable offline local bridge visible instead of promoting mock fallback', () => {
    const initial = createInitialAgentControlState();
    const applied = applyAgentBridgeStatus(initial, 'hermes-local-bridge', {
      status: 'offline',
      provider: 'hermes',
      activeEngine: 'Hermes Agent API hermes-agent',
      currentTask: 'Waiting for Hermes API.',
    });

    const activeConnector = selectAgentBridgeConnector(applied.state);

    expect(activeConnector.id).toBe('hermes-local-bridge');
    expect(activeConnector.status).toBe('offline');
    expect(activeConnector.error).toBeNull();
  });

  it('accepts connected bridge status with task-loop failure activity', () => {
    const initial = createInitialAgentControlState();
    const applied = applyAgentBridgeStatus(initial, 'hermes-local-bridge', {
      status: 'connected',
      provider: 'hermes',
      activeEngine: 'Hermes Agent API hermes-agent',
      activity: [
        {
          id: 'hermes-bridge-status',
          kind: 'connection',
          title: 'Hermes API connected',
          detail: 'Forwarding Mission Control tasks to http://192.0.2.64:8642/v1.',
          timestamp: '2026-05-26T12:00:00.000Z',
          source: 'mission-control-local-agent-bridge',
          status: 'succeeded',
          visibleTo: ['admin', 'support', 'home'],
        },
        {
          id: 'hermes-task-loop-diagnostic',
          kind: 'failure',
          title: 'Task proposal loop failed',
          detail: 'hermes_unsupported_response / top-level keys: status, result',
          timestamp: '2026-05-26T12:00:01.000Z',
          source: 'mission-control-local-agent-bridge',
          status: 'failed',
          visibleTo: ['admin', 'support', 'home'],
        },
      ],
    });

    expect(selectAgentBridgeConnector(applied.state).status).toBe('connected');
    expect(applied.state.activity.find((item) => item.id === 'hermes-task-loop-diagnostic')).toMatchObject({
      kind: 'failure',
      title: 'Task proposal loop failed',
    });
  });

  it('normalizes valid bridge events and rejects malformed status payloads', () => {
    const event = createNotificationEvent();

    expect(isAgentBridgeStatusResponse({ status: 'connected', provider: 'hermes' })).toBe(true);
    expect(isAgentBridgeStatusResponse({ status: 'ok', provider: 'hermes' })).toBe(true);
    expect(isAgentBridgeStatusResponse({ status: 'online', provider: 'hermes' })).toBe(true);
    expect(isAgentBridgeStatusResponse({ status: 'connected', agents: [{ id: 'missing-required-fields' }] })).toBe(true);
    expect(isAgentBridgeStatusResponse({ usage: { requestCount: 1 } })).toBe(false);
    expect(isAgentBridgeStatusResponse({})).toBe(false);
    expect(normalizeAgentBridgeEvent({ missionControlEvents: [event] })).toEqual({
      type: 'mission-events',
      events: [event],
    });
    expect(normalizeAgentBridgeEvent({ missionControlEvents: [{ type: 'command', command: { id: '' } }] })).toBeNull();
  });

  it('adapts loose Hermes/OpenClaw provider status into strict Mission Control records', () => {
    const normalized = normalizeAgentBridgeStatusResponse({
      status: 'up',
      provider: 'Hermes Agent',
      engine: 'hermes-agent',
      agents: [
        {
          id: 'hermes-coordinator',
          name: 'Hermes Coordinator',
          role: 'member',
          model: 'hermes-agent',
          status: 'online',
        },
      ],
      activity: [
        {
          message: 'Gateway ready',
          source: 'hermes',
        },
      ],
    });

    expect(normalized).toMatchObject({
      status: 'connected',
      provider: 'hermes',
      activeEngine: 'hermes-agent',
      agents: [
        {
          id: 'hermes-coordinator',
          specialty: 'home',
          profile: 'home-operator',
          connection: 'online',
          visibleTo: ['home'],
        },
      ],
    });
    expect(normalized?.activity?.[0]).toMatchObject({
      kind: 'connection',
      title: 'Gateway ready',
    });
  });

  it('normalizes Hermes bridge aliases from LAN harness payloads', () => {
    const initial = createInitialAgentControlState();
    const applied = applyAgentBridgeStatus(initial, 'hermes-local-bridge', {
      status: 'ok',
      provider: 'hermes',
      activeEngine: 'Hermes bridge harness',
      activeAgentId: 'hermes-bridge',
      agents: [
        {
          id: 'hermes-bridge',
          name: 'Hermes Bridge',
          specialty: 'coordinator',
          provider: 'hermes',
          model: 'bridge-harness',
          profile: 'home-operator',
          status: 'available',
          connection: 'online',
          summary: 'Local bridge harness for Mission Control connectivity checks.',
          visibleTo: ['admin', 'member', 'guest'] as never,
        },
      ],
      jobs: [],
      permissions: [],
      activity: [],
    });

    const connector = applied.state.connectors.find((item) => item.id === 'hermes-local-bridge');
    expect(connector?.status).toBe('connected');
    expect(applied.state.agents.find((agent) => agent.id === 'hermes-bridge')?.visibleTo).toEqual(['admin', 'home']);
  });

  it('routes SSE mission events through the shared event path', () => {
    const initial = createInitialAgentControlState();
    const event = createNotificationEvent();
    const applied = applyAgentBridgeEvent(initial, 'hermes-local-bridge', {
      type: 'mission-events',
      events: [event],
    });

    expect(applied.state).not.toBe(initial);
    expect(applied.state.lastBridgeEventAt).toBeTruthy();
    expect(applied.missionControlEvents).toEqual([event]);
  });

  it('records diagnostics for bridge failures without selecting a failed connector', () => {
    const initial = createInitialAgentControlState();
    const failed = markAgentBridgeConnectorFailure(initial, 'hermes-local-bridge', 'invalid SSE payload', 'error', 'events', {
      type: 'invalid',
    });

    expect(failed.diagnostics[0]).toMatchObject({
      connectorId: 'hermes-local-bridge',
      level: 'error',
      source: 'events',
      message: 'invalid SSE payload',
    });
    expect(failed.diagnostics[0]?.payloadSummary).toContain('invalid');
    expect(selectAgentBridgeConnector(failed).id).toBe('mock-agent-runtime');
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
