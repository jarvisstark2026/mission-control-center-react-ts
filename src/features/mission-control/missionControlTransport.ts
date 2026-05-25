import { getMockMissionControlEventBatch } from './missionControlMock';
import { normalizeMissionControlEventList } from './missionControlValidation';
import type { MissionControlConnectionState, MissionControlEvent } from './missionControlTypes';

export type MissionControlEventHandler = (events: MissionControlEvent[]) => void;
export type MissionControlStatusHandler = (status: MissionControlConnectionState) => void;

export type MissionControlConnection = {
  close: () => void;
};

export type MissionControlTransport = {
  connect: (
    onEvents: MissionControlEventHandler,
    onStatus?: MissionControlStatusHandler,
  ) => MissionControlConnection;
};

function normalizeMissionControlEvents(payload: unknown): MissionControlEvent[] {
  return normalizeMissionControlEventList(payload);
}

export function createSseMissionControlTransport(url: string): MissionControlTransport {
  return {
    connect(onEvents, onStatus) {
      onStatus?.('connecting');
      const eventSource = new EventSource(url);

      eventSource.onopen = () => onStatus?.('connected');
      eventSource.onerror = () => onStatus?.('error');
      eventSource.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data) as unknown;
          const events = normalizeMissionControlEvents(payload);
          if (events.length) {
            onEvents(events);
          }
        } catch {
          onStatus?.('error');
        }
      };

      return {
        close: () => eventSource.close(),
      };
    },
  };
}

export function createMockMissionControlTransport(intervalMs = 2500): MissionControlTransport {
  return {
    connect(onEvents, onStatus) {
      let tick = 0;
      onStatus?.('mock');
      const intervalId = window.setInterval(() => {
        tick += 1;
        onEvents(getMockMissionControlEventBatch(tick));
      }, intervalMs);

      return {
        close: () => window.clearInterval(intervalId),
      };
    },
  };
}

export function createMissionControlTransport(url: string | undefined): MissionControlTransport {
  return url ? createSseMissionControlTransport(url) : createMockMissionControlTransport();
}
