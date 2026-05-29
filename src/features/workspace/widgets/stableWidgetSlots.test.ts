import { describe, expect, it } from 'vitest';

import type { IntegrationRecord, TelemetrySample } from '../../mission-control';
import { initialIntegrations, initialTelemetrySamples } from '../../mission-control/missionControlMock';
import { getStableIntegrationGroups, getStableTelemetrySamples } from './stableWidgetSlots';

describe('stable widget content slots', () => {
  it('keeps telemetry rows in deterministic channel order when samples arrive in a different order', () => {
    const shuffledTelemetry: TelemetrySample[] = [
      {
        ...initialTelemetrySamples[1],
        id: 'network-later',
        timestamp: '2026-05-22T08:03:00.000Z',
      },
      {
        ...initialTelemetrySamples[0],
        id: 'power-earlier',
        timestamp: '2026-05-22T08:01:00.000Z',
      },
      {
        ...initialTelemetrySamples[2],
        id: 'security-latest',
        timestamp: '2026-05-22T08:04:00.000Z',
      },
    ];

    expect(getStableTelemetrySamples(shuffledTelemetry).map((sample) => sample.channel)).toEqual([
      'power',
      'network',
      'security',
    ]);
  });

  it('keeps integration categories and rows stable when incoming bridge order changes', () => {
    const reorderedIntegrations: IntegrationRecord[] = [...initialIntegrations].reverse();

    const groups = getStableIntegrationGroups(reorderedIntegrations);

    expect(groups.map((group) => group.category)).toEqual(['service', 'device', 'automation', 'media', 'security']);
    expect(groups.find((group) => group.category === 'device')?.items.map((item) => item.name)).toEqual([
      'Battery system',
      'EV charger',
      'Solar inverter',
      'Wall tablets',
    ]);
  });
});
