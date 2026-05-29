import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createBridgeAgentTaskGateway, createMockAgentTaskGateway, type AgentTaskGateway } from '../agent-tasking';
import type { MissionControlEvent } from '../mission-control';
import {
  applyAgentBridgeEvent,
  applyAgentBridgeStatus,
  appendAgentBridgeDiagnostic,
  createAgentBridgeDiagnostic,
  createAgentBridgeTransport,
  markAgentBridgeConnectorFailure,
  selectAgentBridgeConnector,
  isAgentBridgeStatusResponse,
  type AgentBridgeTransportOptions,
  type AgentBridgeProbeResult,
} from './agentBridgeRuntime';
import { createInitialAgentControlState, defaultAgentLocalBridgeUrl, type AgentConnectorRuntimeOptions } from './agentControlModel';
import type { AgentBridgeDiagnosticLevel, AgentBridgeDiagnosticSource, AgentConnectorRecord, AgentConnectorStatus, AgentControlState } from './agentControlTypes';

export type AgentBridgeRuntimeOptions = AgentConnectorRuntimeOptions &
  AgentBridgeTransportOptions & {
    onMissionEvents: (events: MissionControlEvent[]) => void;
    probeIntervalMs?: number;
    disabled?: boolean;
  };

export type AgentBridgeRuntime = {
  state: AgentControlState;
  activeConnector: AgentConnectorRecord;
  taskGateway: AgentTaskGateway;
  probeNow: () => Promise<AgentBridgeProbeResult[]>;
  testUrl: (url: string) => Promise<AgentBridgeProbeResult>;
  recordDiagnostic: (
    message: string,
    source?: AgentBridgeDiagnosticSource,
    level?: AgentBridgeDiagnosticLevel,
    payload?: unknown,
  ) => void;
};

function isRuntimeTestMode() {
  return import.meta.env.MODE === 'test';
}

function canUseConnector(connector: AgentConnectorRecord) {
  return connector.kind !== 'mock' && Boolean(connector.url);
}

function getConnectorProbeOrder(connectors: AgentConnectorRecord[]) {
  return connectors
    .filter(canUseConnector)
    .sort((left, right) => (left.sourcePriority ?? 99) - (right.sourcePriority ?? 99));
}

function normalizeStatusForConnector(status: unknown): AgentConnectorStatus | undefined {
  if (status === 'ok') return 'connected';
  if (
    status === 'connected' ||
    status === 'available' ||
    status === 'offline' ||
    status === 'error' ||
    status === 'not-configured'
  ) {
    return status;
  }
  return undefined;
}

function createProbeConnector(url: string): AgentConnectorRecord {
  return {
    id: 'manual-agent-bridge-probe',
    provider: 'custom',
    kind: 'local',
    url,
    status: 'available',
    lastSeenAt: null,
    healthCheckedAt: null,
    activeEngine: null,
    sourcePriority: 1,
    capabilities: [],
    error: null,
  };
}

export function useAgentBridgeRuntime(options: AgentBridgeRuntimeOptions): AgentBridgeRuntime {
  const runtimeConnectorOptions = useMemo(
    (): AgentConnectorRuntimeOptions => ({
      localBridgeUrl: options.localBridgeUrl ?? defaultAgentLocalBridgeUrl,
      remoteApiUrl: options.remoteApiUrl,
    }),
    [options.localBridgeUrl, options.remoteApiUrl],
  );
  const [state, setState] = useState(() => createInitialAgentControlState(runtimeConnectorOptions));
  const bridgeRuntimeDisabled = Boolean(options.disabled || isRuntimeTestMode());
  const stateRef = useRef(state);
  const missionEventsRef = useRef(options.onMissionEvents);
  const transportOptionsRef = useRef<AgentBridgeTransportOptions>({
    fetchImpl: options.fetchImpl,
    eventSourceFactory: options.eventSourceFactory,
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setState((current) => {
      const nextState = createInitialAgentControlState(runtimeConnectorOptions);
      return {
        ...current,
        connectors: nextState.connectors,
        activeConnectorId: nextState.activeConnectorId,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [runtimeConnectorOptions]);

  useEffect(() => {
    missionEventsRef.current = options.onMissionEvents;
    transportOptionsRef.current = {
      fetchImpl: options.fetchImpl,
      eventSourceFactory: options.eventSourceFactory,
    };
  }, [options.eventSourceFactory, options.fetchImpl, options.onMissionEvents]);

  const testUrl = useCallback(async (url: string): Promise<AgentBridgeProbeResult> => {
    const trimmedUrl = url.trim().replace(/\/+$/u, '');
    if (!trimmedUrl) {
      return {
        url,
        ok: false,
        error: 'Bridge URL is not configured.',
      };
    }

    try {
      const transport = createAgentBridgeTransport(createProbeConnector(trimmedUrl), transportOptionsRef.current);
      const response = await transport.checkStatus();
      if (!isAgentBridgeStatusResponse(response)) {
        return {
          url: trimmedUrl,
          ok: false,
          error: 'Bridge /status payload did not match the Mission Control contract.',
        };
      }

      return {
        url: trimmedUrl,
        ok: true,
        status: normalizeStatusForConnector(response.status) ?? 'connected',
        provider: response.provider,
        activeEngine: response.activeEngine ?? undefined,
      };
    } catch (error) {
      return {
        url: trimmedUrl,
        ok: false,
        error: error instanceof Error ? error.message : 'Bridge probe failed.',
      };
    }
  }, []);

  const probeNow = useCallback(async (): Promise<AgentBridgeProbeResult[]> => {
    const connectors = getConnectorProbeOrder(stateRef.current.connectors);
    const results: AgentBridgeProbeResult[] = [];

    for (const connector of connectors) {
      if (!connector.url) continue;

      try {
        const transport = createAgentBridgeTransport(connector, transportOptionsRef.current);
        const response = await transport.checkStatus();
        const result: AgentBridgeProbeResult = {
          url: connector.url,
          ok: true,
          status: normalizeStatusForConnector(response.status) ?? 'connected',
          provider: response.provider,
          activeEngine: response.activeEngine ?? undefined,
        };
        results.push(result);
        setState((current) => applyAgentBridgeStatus(current, connector.id, response).state);
        break;
      } catch (error) {
        const result: AgentBridgeProbeResult = {
          url: connector.url,
          ok: false,
          error: error instanceof Error ? error.message : 'Bridge probe failed.',
        };
        results.push(result);
        setState((current) =>
          markAgentBridgeConnectorFailure(
            current,
            connector.id,
            result.error ?? 'Bridge probe failed.',
            'offline',
            'status',
          ),
        );
      }
    }

    return results;
  }, []);

  const recordDiagnostic = useCallback(
    (
      message: string,
      source: AgentBridgeDiagnosticSource = 'runtime',
      level: AgentBridgeDiagnosticLevel = 'warning',
      payload?: unknown,
    ) => {
      const connector = selectAgentBridgeConnector(stateRef.current);
      setState((current) =>
        appendAgentBridgeDiagnostic(
          current,
          createAgentBridgeDiagnostic({
            connectorId: connector.id,
            level,
            message,
            source,
            payload,
          }),
        ),
      );
    },
    [],
  );

  useEffect(() => {
    if (bridgeRuntimeDisabled) return undefined;

    let closed = false;
    let eventStream: { close: () => void } | null = null;

    const closeEventStream = () => {
      eventStream?.close();
      eventStream = null;
    };

    const applyState = (
      updater: (current: AgentControlState) => { state: AgentControlState; missionControlEvents?: MissionControlEvent[] },
    ) => {
      setState((current) => {
        const next = updater(current);
        if (next.missionControlEvents?.length) {
          missionEventsRef.current(next.missionControlEvents);
        }
        return next.state;
      });
    };

    const openEvents = (connector: AgentConnectorRecord) => {
      closeEventStream();
      setState((current) => ({
        ...current,
        eventStreamStatus: 'connecting',
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      }));

      try {
        const transport = createAgentBridgeTransport(connector, transportOptionsRef.current);
        eventStream = transport.connectEvents(
          (event) => {
            if (closed) return;
            applyState((current) => applyAgentBridgeEvent(current, connector.id, event));
          },
          (error) => {
            if (closed) return;
            setState((current) => markAgentBridgeConnectorFailure(current, connector.id, error.message, 'error', 'events'));
            closeEventStream();
          },
        );
      } catch (error) {
        setState((current) =>
          markAgentBridgeConnectorFailure(
            current,
            connector.id,
            error instanceof Error ? error.message : 'Agent bridge SSE setup failed.',
            'error',
            'events',
          ),
        );
        closeEventStream();
      }
    };

    const probe = async () => {
      const connectors = getConnectorProbeOrder(stateRef.current.connectors);
      let connected = false;

      for (const connector of connectors) {
        if (closed) return;

        try {
          const transport = createAgentBridgeTransport(connector, transportOptionsRef.current);
          const response = await transport.checkStatus();

          if (closed) return;

          applyState((current) => applyAgentBridgeStatus(current, connector.id, response));
          openEvents({
            ...connector,
            status: normalizeStatusForConnector(response.status) ?? 'connected',
            provider: response.provider ?? connector.provider,
            activeEngine: response.activeEngine ?? connector.activeEngine ?? null,
            lastSeenAt: response.lastSeenAt ?? new Date().toISOString(),
          });
          connected = true;
          break;
        } catch (error) {
          if (closed) return;
          setState((current) =>
            markAgentBridgeConnectorFailure(
              current,
              connector.id,
              error instanceof Error ? error.message : 'Agent bridge probe failed.',
              'offline',
              'status',
            ),
          );
        }
      }

      if (!connected) {
        closeEventStream();
      }
    };

    void probe();
    const interval = window.setInterval(() => {
      void probe();
    }, options.probeIntervalMs ?? 15_000);

    return () => {
      closed = true;
      window.clearInterval(interval);
      closeEventStream();
    };
  }, [bridgeRuntimeDisabled, options.localBridgeUrl, options.probeIntervalMs, options.remoteApiUrl]);

  const activeConnector = useMemo(() => selectAgentBridgeConnector(state), [state]);
  const taskGateway = useMemo(() => {
    if (bridgeRuntimeDisabled) {
      return createMockAgentTaskGateway();
    }

    if (
      activeConnector.kind === 'mock' ||
      !activeConnector.url ||
      activeConnector.status !== 'connected'
    ) {
      return createMockAgentTaskGateway();
    }

    return createBridgeAgentTaskGateway(activeConnector.url, {
      onDiagnostic: (message, payload) => {
        setState((current) =>
          appendAgentBridgeDiagnostic(
            current,
            createAgentBridgeDiagnostic({
              connectorId: activeConnector.id,
              level: 'error',
              message,
              source: 'tasks',
              payload,
            }),
          ),
        );
      },
    });
  }, [activeConnector.id, activeConnector.kind, activeConnector.status, activeConnector.url, bridgeRuntimeDisabled]);

  return useMemo(
    () => ({
      state,
      activeConnector,
      taskGateway,
      probeNow,
      testUrl,
      recordDiagnostic,
    }),
    [activeConnector, probeNow, recordDiagnostic, state, taskGateway, testUrl],
  );
}
