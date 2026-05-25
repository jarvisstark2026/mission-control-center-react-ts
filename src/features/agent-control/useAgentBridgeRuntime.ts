import { useEffect, useMemo, useRef, useState } from 'react';

import { createBridgeAgentTaskGateway, createMockAgentTaskGateway, type AgentTaskGateway } from '../agent-tasking';
import type { MissionControlEvent } from '../mission-control';
import {
  applyAgentBridgeEvent,
  applyAgentBridgeStatus,
  createAgentBridgeTransport,
  markAgentBridgeConnectorFailure,
  selectAgentBridgeConnector,
  type AgentBridgeTransportOptions,
} from './agentBridgeRuntime';
import { createInitialAgentControlState, defaultAgentLocalBridgeUrl, type AgentConnectorRuntimeOptions } from './agentControlModel';
import type { AgentConnectorRecord, AgentControlState } from './agentControlTypes';

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

      try {
        const transport = createAgentBridgeTransport(connector, transportOptionsRef.current);
        eventStream = transport.connectEvents(
          (event) => {
            if (closed) return;
            applyState((current) => applyAgentBridgeEvent(current, connector.id, event));
          },
          (error) => {
            if (closed) return;
            setState((current) => markAgentBridgeConnectorFailure(current, connector.id, error.message, 'error'));
            closeEventStream();
          },
        );
      } catch {
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
            status: response.status ?? 'connected',
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
      (activeConnector.status !== 'connected' && activeConnector.status !== 'available')
    ) {
      return createMockAgentTaskGateway();
    }

    return createBridgeAgentTaskGateway(activeConnector.url);
  }, [activeConnector.kind, activeConnector.status, activeConnector.url, bridgeRuntimeDisabled]);

  return useMemo(
    () => ({
      state,
      activeConnector,
      taskGateway,
    }),
    [activeConnector, state, taskGateway],
  );
}
