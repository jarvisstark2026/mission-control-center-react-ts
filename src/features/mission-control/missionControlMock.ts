import type {
  CommandRequest,
  DeviceRecord,
  IntegrationRecord,
  MissionControlEvent,
  MissionNotification,
  TelemetrySample,
} from './missionControlTypes';

const initialTimestamp = '2026-05-22T08:00:00.000Z';

export const initialTelemetrySamples: TelemetrySample[] = [
  {
    id: 'telemetry-grid-load',
    channel: 'power',
    label: 'Grid load',
    value: 42,
    unit: '%',
    trend: 'flat',
    severity: 'nominal',
    timestamp: initialTimestamp,
  },
  {
    id: 'telemetry-tailnet',
    channel: 'network',
    label: 'Tailnet latency',
    value: 18,
    unit: 'ms',
    trend: 'down',
    severity: 'nominal',
    timestamp: initialTimestamp,
  },
  {
    id: 'telemetry-camera-sync',
    channel: 'security',
    label: 'Camera sync',
    value: 96,
    unit: '%',
    trend: 'up',
    severity: 'notice',
    timestamp: initialTimestamp,
  },
];

export const initialNotifications: MissionNotification[] = [
  {
    id: 'notification-live-core',
    level: 'notice',
    title: 'Live core online',
    body: 'Local mission stream is feeding telemetry, commands, and integration heartbeats.',
    source: 'mission-control',
    timestamp: initialTimestamp,
    acknowledged: false,
  },
  {
    id: 'notification-camera-heartbeat',
    level: 'warning',
    title: 'Camera heartbeat delayed',
    body: 'Driveway camera reported a slow heartbeat and needs a permission review.',
    source: 'registry',
    timestamp: initialTimestamp,
    acknowledged: false,
  },
];

export const initialCommands: CommandRequest[] = [
  {
    id: 'command-evening-routine',
    title: 'Run evening routine',
    summary: 'Dim common-area lights, arm perimeter reminders, and set climate to night mode.',
    source: 'home-agent',
    agent: {
      agentId: 'jarvis-primary',
      agentName: 'Mission Control Coordinator',
      profile: 'home-operator',
    },
    reasoning: 'Evening occupancy is stable and the schedule widget shows the home is inside the normal night-prep window.',
    expectedResult: 'Household comfort settings move to night mode without touching high-risk security controls.',
    scope: 'household',
    risk: 'safe',
    status: 'pending',
    requestedAt: initialTimestamp,
    execution: {
      status: 'not-started',
      result: 'Waiting for a household-safe approval.',
      rollbackAvailable: true,
    },
    auditTrail: [
      {
        id: 'audit-command-evening-routine-proposed',
        type: 'proposed',
        actor: 'Mission Control Coordinator',
        timestamp: initialTimestamp,
        detail: 'Proposed as a safe household command.',
      },
    ],
  },
  {
    id: 'command-router-restart',
    title: 'Restart media VLAN',
    summary: 'Cycle the media network to clear stream buffering on two devices.',
    source: 'support-agent',
    agent: {
      agentId: 'jarvis-support',
      agentName: 'Support Agent',
      profile: 'support-diagnostics',
    },
    reasoning: 'Media hub telemetry is healthy, but stream recovery needs a network-level reset that should stay behind support gates.',
    expectedResult: 'Media devices reconnect after a local dry-run network cycle; no command runs until backend execution is connected.',
    scope: 'support',
    risk: 'elevated',
    status: 'pending',
    requestedAt: initialTimestamp,
    execution: {
      status: 'not-started',
      result: 'Waiting for support/admin decision.',
      rollbackAvailable: false,
    },
    auditTrail: [
      {
        id: 'audit-command-router-restart-proposed',
        type: 'proposed',
        actor: 'Support Agent',
        timestamp: initialTimestamp,
        detail: 'Proposed as an elevated support command.',
      },
    ],
  },
  {
    id: 'command-lockdown-test',
    title: 'Run security lockdown test',
    summary: 'Simulate emergency lock state without actuating physical locks.',
    source: 'security-agent',
    agent: {
      agentId: 'jarvis-security',
      agentName: 'Security Agent',
      profile: 'security-watch',
    },
    reasoning: 'Security profile requested a dry-run only. Critical scope still requires admin override visibility.',
    expectedResult: 'Simulation records a lockdown rehearsal without changing physical devices.',
    scope: 'security',
    risk: 'critical',
    status: 'pending',
    requestedAt: initialTimestamp,
    execution: {
      status: 'not-started',
      result: 'Waiting for admin approval or override.',
      rollbackAvailable: false,
    },
    auditTrail: [
      {
        id: 'audit-command-lockdown-test-proposed',
        type: 'proposed',
        actor: 'Security Agent',
        timestamp: initialTimestamp,
        detail: 'Proposed as a critical simulation command.',
      },
    ],
  },
];

export const initialIntegrations: IntegrationRecord[] = [
  {
    id: 'integration-tailnet',
    name: 'Tailnet router',
    category: 'service',
    status: 'online',
    permission: 'control',
    heartbeatAt: initialTimestamp,
    scope: 'system',
  },
  {
    id: 'integration-driveway-camera',
    name: 'Driveway camera',
    category: 'security',
    status: 'degraded',
    permission: 'read',
    heartbeatAt: initialTimestamp,
    scope: 'security',
  },
  {
    id: 'integration-media-hub',
    name: 'Media hub',
    category: 'media',
    status: 'online',
    permission: 'read',
    heartbeatAt: initialTimestamp,
    scope: 'household',
  },
  {
    id: 'integration-home-assistant',
    name: 'Home Assistant bridge',
    category: 'service',
    status: 'online',
    permission: 'control',
    heartbeatAt: initialTimestamp,
    scope: 'household',
  },
  {
    id: 'integration-solar-inverter',
    name: 'Solar inverter',
    category: 'device',
    status: 'online',
    permission: 'read',
    heartbeatAt: initialTimestamp,
    scope: 'household',
  },
  {
    id: 'integration-home-battery',
    name: 'Battery system',
    category: 'device',
    status: 'online',
    permission: 'control',
    heartbeatAt: initialTimestamp,
    scope: 'household',
  },
  {
    id: 'integration-ev-charger',
    name: 'EV charger',
    category: 'device',
    status: 'online',
    permission: 'control',
    heartbeatAt: initialTimestamp,
    scope: 'household',
  },
  {
    id: 'integration-alarm-panel',
    name: 'Home alarm',
    category: 'security',
    status: 'online',
    permission: 'blocked',
    heartbeatAt: initialTimestamp,
    scope: 'security',
  },
  {
    id: 'integration-cctv-nvr',
    name: 'CCTV / NVR',
    category: 'security',
    status: 'degraded',
    permission: 'read',
    heartbeatAt: initialTimestamp,
    scope: 'security',
  },
  {
    id: 'integration-pool-controller',
    name: 'Pool controller',
    category: 'automation',
    status: 'online',
    permission: 'control',
    heartbeatAt: initialTimestamp,
    scope: 'household',
  },
  {
    id: 'integration-wall-tablets',
    name: 'Wall tablets',
    category: 'device',
    status: 'online',
    permission: 'read',
    heartbeatAt: initialTimestamp,
    scope: 'household',
  },
];

export const initialDevices: DeviceRecord[] = [
  {
    id: 'device-router',
    name: 'Core router',
    integrationId: 'integration-tailnet',
    zone: 'network rack',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-driveway-camera',
    name: 'Driveway camera',
    integrationId: 'integration-driveway-camera',
    zone: 'front exterior',
    status: 'degraded',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-media-hub',
    name: 'Living room media hub',
    integrationId: 'integration-media-hub',
    zone: 'living room',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-home-meter',
    name: 'Whole-home meter',
    integrationId: 'integration-home-assistant',
    zone: 'main panel',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-solar-inverter',
    name: 'Solar PV inverter',
    integrationId: 'integration-solar-inverter',
    zone: 'roof array',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-home-battery',
    name: 'Battery controller',
    integrationId: 'integration-home-battery',
    zone: 'utility room',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-ev-charger',
    name: 'Garage EV charger',
    integrationId: 'integration-ev-charger',
    zone: 'garage',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-alarm-panel',
    name: 'Alarm panel',
    integrationId: 'integration-alarm-panel',
    zone: 'entry hall',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-pool-controller',
    name: 'Pool pump controller',
    integrationId: 'integration-pool-controller',
    zone: 'pool plant',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
  {
    id: 'device-kitchen-tablet',
    name: 'Kitchen wall tablet',
    integrationId: 'integration-wall-tablets',
    zone: 'kitchen',
    status: 'online',
    lastSeenAt: initialTimestamp,
  },
];

const telemetryCycle: Array<Omit<TelemetrySample, 'id' | 'timestamp'>> = [
  {
    channel: 'network',
    label: 'Tailnet latency',
    value: 21,
    unit: 'ms',
    trend: 'up',
    severity: 'notice',
  },
  {
    channel: 'power',
    label: 'Battery reserve',
    value: 87,
    unit: '%',
    trend: 'flat',
    severity: 'nominal',
  },
  {
    channel: 'automation',
    label: 'Queue pressure',
    value: 6,
    unit: 'jobs',
    trend: 'down',
    severity: 'nominal',
  },
  {
    channel: 'security',
    label: 'Perimeter confidence',
    value: 92,
    unit: '%',
    trend: 'up',
    severity: 'notice',
  },
];

export function getMockMissionControlEventBatch(tick: number, now = new Date()): MissionControlEvent[] {
  const timestamp = now.toISOString();
  const telemetry = telemetryCycle[tick % telemetryCycle.length];
  const events: MissionControlEvent[] = [
    {
      type: 'telemetry',
      sample: {
        ...telemetry,
        id: `mock-telemetry-${tick}`,
        timestamp,
      },
    },
    {
      type: 'integration',
      integration: {
        ...initialIntegrations[tick % initialIntegrations.length],
        status: tick % 5 === 0 ? 'degraded' : 'online',
        heartbeatAt: timestamp,
      },
    },
  ];

  if (tick % 3 === 0) {
    events.push({
      type: 'notification',
      notification: {
        id: `mock-notification-${tick}`,
        level: tick % 6 === 0 ? 'warning' : 'notice',
        title: tick % 6 === 0 ? 'Integration needs review' : 'Telemetry checkpoint',
        body: tick % 6 === 0 ? 'One integration reported a slower heartbeat.' : 'Live mission telemetry refreshed.',
        source: tick % 6 === 0 ? 'registry' : 'telemetry',
        timestamp,
        acknowledged: false,
      },
    });
  }

  return events;
}
