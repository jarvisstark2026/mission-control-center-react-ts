import type { IntegrationRecord, TelemetrySample } from '../../mission-control';
import type { TelemetryChannel } from '../../mission-control/missionControlTypes';

const telemetryChannelOrder: TelemetryChannel[] = ['power', 'network', 'security', 'comfort', 'automation'];
const integrationCategoryOrder: IntegrationRecord['category'][] = ['service', 'device', 'automation', 'media', 'security'];

function getTelemetryTimestamp(sample: TelemetrySample) {
  const timestamp = Date.parse(sample.timestamp);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getStableTelemetrySamples(telemetry: TelemetrySample[]) {
  return [...telemetry].sort((left, right) => {
    const channelDelta = telemetryChannelOrder.indexOf(left.channel) - telemetryChannelOrder.indexOf(right.channel);
    if (channelDelta !== 0) return channelDelta;

    const timeDelta = getTelemetryTimestamp(right) - getTelemetryTimestamp(left);
    if (timeDelta !== 0) return timeDelta;

    return left.id.localeCompare(right.id);
  });
}

export function getLatestTelemetrySample(telemetry: TelemetrySample[]) {
  return [...telemetry].sort((left, right) => {
    const timeDelta = getTelemetryTimestamp(right) - getTelemetryTimestamp(left);
    if (timeDelta !== 0) return timeDelta;
    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

export function getLatestTelemetryByChannel(telemetry: TelemetrySample[]) {
  return telemetryChannelOrder.flatMap((channel) => {
    const latestForChannel = telemetry
      .filter((sample) => sample.channel === channel)
      .sort((left, right) => {
        const timeDelta = getTelemetryTimestamp(right) - getTelemetryTimestamp(left);
        if (timeDelta !== 0) return timeDelta;
        return left.id.localeCompare(right.id);
      })[0];

    return latestForChannel ? [latestForChannel] : [];
  });
}

function getIntegrationCategoryRank(category: IntegrationRecord['category']) {
  const index = integrationCategoryOrder.indexOf(category);
  return index === -1 ? integrationCategoryOrder.length : index;
}

export function getStableIntegrationGroups(integrations: IntegrationRecord[]) {
  const categories = Array.from(new Set(integrations.map((integration) => integration.category))).sort((left, right) => {
    const rankDelta = getIntegrationCategoryRank(left) - getIntegrationCategoryRank(right);
    if (rankDelta !== 0) return rankDelta;
    return left.localeCompare(right);
  });

  return categories.map((category) => ({
    category,
    items: integrations
      .filter((integration) => integration.category === category)
      .sort((left, right) => {
        const nameDelta = left.name.localeCompare(right.name);
        if (nameDelta !== 0) return nameDelta;
        return left.id.localeCompare(right.id);
      }),
  }));
}
