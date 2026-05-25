import type { MissionControlEvent } from './missionControlTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStringId(value: unknown) {
  return isRecord(value) && typeof value.id === 'string' && value.id.trim().length > 0;
}

export function isMissionControlEvent(value: unknown): value is MissionControlEvent {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  if (value.type === 'telemetry') {
    return hasStringId(value.sample) && typeof (value.sample as Record<string, unknown>).timestamp === 'string';
  }

  if (value.type === 'notification') {
    return hasStringId(value.notification) && typeof (value.notification as Record<string, unknown>).title === 'string';
  }

  if (value.type === 'command') {
    const command = value.command;
    return (
      hasStringId(command) &&
      typeof (command as Record<string, unknown>).title === 'string' &&
      Array.isArray((command as Record<string, unknown>).auditTrail)
    );
  }

  if (value.type === 'integration') {
    return hasStringId(value.integration) && typeof (value.integration as Record<string, unknown>).heartbeatAt === 'string';
  }

  if (value.type === 'device') {
    return hasStringId(value.device) && typeof (value.device as Record<string, unknown>).lastSeenAt === 'string';
  }

  return false;
}

export function normalizeMissionControlEventList(value: unknown): MissionControlEvent[] {
  if (Array.isArray(value)) return value.filter(isMissionControlEvent);
  if (isMissionControlEvent(value)) return [value];
  if (isRecord(value) && Array.isArray(value.events)) return value.events.filter(isMissionControlEvent);
  return [];
}
