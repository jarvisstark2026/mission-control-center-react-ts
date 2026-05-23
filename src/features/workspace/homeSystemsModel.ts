export type HomeSystemCategory =
  | 'energy'
  | 'solar'
  | 'vehicle'
  | 'climate'
  | 'appliance'
  | 'automation'
  | 'security'
  | 'safety'
  | 'camera'
  | 'pool'
  | 'tablet'
  | 'other';

export type HomeSystemStatus = 'online' | 'degraded' | 'offline' | 'standby';

export type HomeSystemCapability = 'monitor' | 'control' | 'automate' | 'safety';

export type HomeEnergySnapshot = {
  consumptionKw: number;
  generationKw: number;
  solarPvKw: number;
  batteryPercent: number;
  evChargeKw: number;
  evRangeKm: number;
  timestamp: string;
};

export type HomeEnergySeriesId =
  | 'gridImportKw'
  | 'solarPvKw'
  | 'batteryChargeKw'
  | 'batteryDischargeKw'
  | 'evChargeKw'
  | 'acKw'
  | 'powerSocketsKw'
  | 'appliancesKw'
  | 'poolKw';

export type HomeEnergySeries = {
  id: HomeEnergySeriesId;
  label: string;
  shortLabel: string;
  group: 'supply' | 'storage' | 'load';
  color: string;
  defaultVisible: boolean;
};

export type HomeEnergyDailySample = {
  hour: number;
  label: string;
} & Record<HomeEnergySeriesId, number>;

export type HomeEnergySeriesTotal = HomeEnergySeries & {
  totalKwh: number;
  peakKw: number;
};

export type HomeEnergyDailySummary = {
  consumptionKwh: number;
  generationKwh: number;
  gridImportKwh: number;
  estimatedGridExportKwh: number;
  batteryChargeKwh: number;
  batteryDischargeKwh: number;
  batteryNetKwh: number;
  evKwh: number;
  acKwh: number;
  socketsKwh: number;
  appliancesKwh: number;
  poolKwh: number;
  flexibleLoadKwh: number;
  peakKw: number;
  selfSupplyEstimatePercent: number;
  largestLoad: HomeEnergySeriesTotal;
};

export type HomeEnergySeriesGroup = {
  group: HomeEnergySeries['group'];
  label: string;
  series: HomeEnergySeries[];
};

export type HomeSystemRecord = {
  id: string;
  name: string;
  category: HomeSystemCategory;
  zone: string;
  status: HomeSystemStatus;
  capability: HomeSystemCapability;
  metric: string;
  detail: string;
};

export type HomeSystemGroup = {
  category: HomeSystemCategory;
  label: string;
  records: HomeSystemRecord[];
};

export type HomeEnergyBalance = {
  netKw: number;
  selfSupplyPercent: number;
  mode: 'exporting' | 'importing' | 'balanced';
};

const homeSystemCategoryOrder: HomeSystemCategory[] = [
  'energy',
  'solar',
  'vehicle',
  'climate',
  'appliance',
  'automation',
  'security',
  'safety',
  'camera',
  'pool',
  'tablet',
  'other',
];

const homeSystemCategoryLabels: Record<HomeSystemCategory, string> = {
  energy: 'Electricity',
  solar: 'Solar PV',
  vehicle: 'Electric car',
  climate: 'AC and climate',
  appliance: 'Home appliances',
  automation: 'Home automation',
  security: 'Alarm system',
  safety: 'Smoke detection',
  camera: 'CCTV and doorbell',
  pool: 'Pool system',
  tablet: 'Wall tablets',
  other: 'Other home devices',
};

export const homeEnergySnapshot: HomeEnergySnapshot = {
  consumptionKw: 3.8,
  generationKw: 4.6,
  solarPvKw: 4.6,
  batteryPercent: 72,
  evChargeKw: 6.9,
  evRangeKm: 238,
  timestamp: '2026-05-22T08:00:00.000Z',
};

export const homeEnergySeries: HomeEnergySeries[] = [
  { id: 'gridImportKw', label: 'Grid import', shortLabel: 'Grid', group: 'supply', color: '#ffbc5c', defaultVisible: true },
  { id: 'solarPvKw', label: 'Solar PV generation', shortLabel: 'Solar', group: 'supply', color: '#56ddff', defaultVisible: true },
  { id: 'batteryChargeKw', label: 'Battery charge', shortLabel: 'Battery in', group: 'storage', color: '#7dffcf', defaultVisible: true },
  { id: 'batteryDischargeKw', label: 'Battery discharge', shortLabel: 'Battery out', group: 'storage', color: '#9fb7ff', defaultVisible: false },
  { id: 'evChargeKw', label: 'Electric car charging', shortLabel: 'EV', group: 'load', color: '#c8a6ff', defaultVisible: true },
  { id: 'acKw', label: 'AC consumption', shortLabel: 'AC', group: 'load', color: '#ff8fa3', defaultVisible: true },
  { id: 'powerSocketsKw', label: 'Power sockets', shortLabel: 'Sockets', group: 'load', color: '#d7e4ef', defaultVisible: true },
  { id: 'appliancesKw', label: 'Appliances', shortLabel: 'Appliances', group: 'load', color: '#a7d06d', defaultVisible: false },
  { id: 'poolKw', label: 'Pool system', shortLabel: 'Pool', group: 'load', color: '#5fc8d7', defaultVisible: false },
];

export const defaultVisibleHomeEnergySeriesIds = homeEnergySeries
  .filter((series) => series.defaultVisible)
  .map((series) => series.id);

export const homeEnergyDailyProfile: HomeEnergyDailySample[] = [
  { hour: 0, label: '00:00', gridImportKw: 1.2, solarPvKw: 0, batteryChargeKw: 0, batteryDischargeKw: 0.6, evChargeKw: 0, acKw: 0.3, powerSocketsKw: 0.35, appliancesKw: 0.22, poolKw: 0 },
  { hour: 2, label: '02:00', gridImportKw: 1.0, solarPvKw: 0, batteryChargeKw: 0, batteryDischargeKw: 0.5, evChargeKw: 0, acKw: 0.28, powerSocketsKw: 0.3, appliancesKw: 0.18, poolKw: 0 },
  { hour: 4, label: '04:00', gridImportKw: 0.9, solarPvKw: 0, batteryChargeKw: 0, batteryDischargeKw: 0.4, evChargeKw: 0, acKw: 0.25, powerSocketsKw: 0.28, appliancesKw: 0.16, poolKw: 0 },
  { hour: 6, label: '06:00', gridImportKw: 1.8, solarPvKw: 0.4, batteryChargeKw: 0, batteryDischargeKw: 0.2, evChargeKw: 0, acKw: 0.42, powerSocketsKw: 0.6, appliancesKw: 0.48, poolKw: 0 },
  { hour: 8, label: '08:00', gridImportKw: 0.8, solarPvKw: 2.4, batteryChargeKw: 0.7, batteryDischargeKw: 0, evChargeKw: 0, acKw: 0.55, powerSocketsKw: 0.9, appliancesKw: 0.8, poolKw: 0.2 },
  { hour: 10, label: '10:00', gridImportKw: 0.2, solarPvKw: 4.7, batteryChargeKw: 1.8, batteryDischargeKw: 0, evChargeKw: 0, acKw: 0.9, powerSocketsKw: 0.7, appliancesKw: 0.55, poolKw: 0.4 },
  { hour: 12, label: '12:00', gridImportKw: 0, solarPvKw: 6.2, batteryChargeKw: 2.4, batteryDischargeKw: 0, evChargeKw: 1.4, acKw: 1.2, powerSocketsKw: 0.8, appliancesKw: 0.5, poolKw: 0.65 },
  { hour: 14, label: '14:00', gridImportKw: 0, solarPvKw: 5.8, batteryChargeKw: 1.2, batteryDischargeKw: 0, evChargeKw: 4.8, acKw: 1.45, powerSocketsKw: 0.75, appliancesKw: 0.45, poolKw: 0.62 },
  { hour: 16, label: '16:00', gridImportKw: 0.4, solarPvKw: 3.6, batteryChargeKw: 0.2, batteryDischargeKw: 0.1, evChargeKw: 3.2, acKw: 1.25, powerSocketsKw: 0.85, appliancesKw: 0.65, poolKw: 0.4 },
  { hour: 18, label: '18:00', gridImportKw: 2.6, solarPvKw: 1.1, batteryChargeKw: 0, batteryDischargeKw: 0.7, evChargeKw: 0, acKw: 1.1, powerSocketsKw: 1.1, appliancesKw: 1.2, poolKw: 0.1 },
  { hour: 20, label: '20:00', gridImportKw: 3.3, solarPvKw: 0, batteryChargeKw: 0, batteryDischargeKw: 0.9, evChargeKw: 0, acKw: 0.85, powerSocketsKw: 1.35, appliancesKw: 1.4, poolKw: 0 },
  { hour: 22, label: '22:00', gridImportKw: 1.7, solarPvKw: 0, batteryChargeKw: 0, batteryDischargeKw: 0.8, evChargeKw: 0, acKw: 0.5, powerSocketsKw: 0.7, appliancesKw: 0.4, poolKw: 0 },
  { hour: 24, label: '24:00', gridImportKw: 1.1, solarPvKw: 0, batteryChargeKw: 0, batteryDischargeKw: 0.6, evChargeKw: 0, acKw: 0.32, powerSocketsKw: 0.4, appliancesKw: 0.2, poolKw: 0 },
];

export const homeSystemRecords: HomeSystemRecord[] = [
  {
    id: 'home-meter-main',
    name: 'Whole-home meter',
    category: 'energy',
    zone: 'main panel',
    status: 'online',
    capability: 'monitor',
    metric: '3.8 kW load',
    detail: 'Tracks live consumption against local generation and battery reserve.',
  },
  {
    id: 'home-inverter-solar',
    name: 'Solar PV inverter',
    category: 'solar',
    zone: 'roof array',
    status: 'online',
    capability: 'monitor',
    metric: '4.6 kW producing',
    detail: 'PV output is above current house load and ready for export or battery charging.',
  },
  {
    id: 'home-ev-charger',
    name: 'Electric car charger',
    category: 'vehicle',
    zone: 'garage',
    status: 'online',
    capability: 'control',
    metric: '6.9 kW charging',
    detail: 'Charging can be scheduled behind solar surplus and tariff windows.',
  },
  {
    id: 'home-ac-zones',
    name: 'AC zone controller',
    category: 'climate',
    zone: 'whole house',
    status: 'online',
    capability: 'control',
    metric: '22.5 C target',
    detail: 'Monitors AC demand and can stage comfort changes through Command Inbox.',
  },
  {
    id: 'home-heat-pump',
    name: 'Heat pump water heater',
    category: 'appliance',
    zone: 'utility room',
    status: 'standby',
    capability: 'control',
    metric: 'standby',
    detail: 'Ready to run during solar surplus or low tariff periods.',
  },
  {
    id: 'home-washer-dryer',
    name: 'Laundry appliances',
    category: 'appliance',
    zone: 'laundry',
    status: 'online',
    capability: 'monitor',
    metric: 'cycle idle',
    detail: 'Appliance telemetry is grouped so high-load cycles can be coordinated.',
  },
  {
    id: 'home-window-automation',
    name: 'Auto-closing windows',
    category: 'automation',
    zone: 'bedrooms',
    status: 'degraded',
    capability: 'automate',
    metric: '1 actuator delayed',
    detail: 'Window actuators should close on rain, alarm arm, or air-quality events after approval.',
  },
  {
    id: 'home-alarm-panel',
    name: 'Home alarm panel',
    category: 'security',
    zone: 'entry hall',
    status: 'online',
    capability: 'safety',
    metric: 'disarmed home',
    detail: 'Alarm state is readable here; arm/disarm actions remain high-trust gated.',
  },
  {
    id: 'home-smoke-detectors',
    name: 'Smoke and CO detectors',
    category: 'safety',
    zone: 'all floors',
    status: 'online',
    capability: 'safety',
    metric: '9 sensors clear',
    detail: 'Safety sensors are separated from comfort automation and never hidden behind presets.',
  },
  {
    id: 'home-cctv-core',
    name: 'CCTV recorder',
    category: 'camera',
    zone: 'security rack',
    status: 'online',
    capability: 'monitor',
    metric: '7 cameras live',
    detail: 'Camera status, storage health, and recording continuity belong in this home surface.',
  },
  {
    id: 'home-doorbell',
    name: 'Video doorbell',
    category: 'camera',
    zone: 'front door',
    status: 'degraded',
    capability: 'monitor',
    metric: 'slow heartbeat',
    detail: 'Doorbell latency is visible alongside CCTV so entry events are easy to audit.',
  },
  {
    id: 'home-pool-system',
    name: 'Pool pump and chemistry',
    category: 'pool',
    zone: 'pool plant',
    status: 'online',
    capability: 'control',
    metric: 'pump low speed',
    detail: 'Pool circulation, heating, and chemistry can be scheduled around energy surplus.',
  },
  {
    id: 'home-tablet-kitchen',
    name: 'Kitchen wall tablet',
    category: 'tablet',
    zone: 'kitchen',
    status: 'online',
    capability: 'monitor',
    metric: 'control surface live',
    detail: 'The Home Systems widget can be propagated as a local-network control view.',
  },
  {
    id: 'home-tablet-hall',
    name: 'Hall wall tablet',
    category: 'tablet',
    zone: 'entry hall',
    status: 'online',
    capability: 'monitor',
    metric: 'control surface live',
    detail: 'Tablet surfaces should mirror role-safe controls and monitoring state.',
  },
  {
    id: 'home-leak-irrigation',
    name: 'Water leak and irrigation',
    category: 'other',
    zone: 'garden / utility',
    status: 'standby',
    capability: 'automate',
    metric: 'no leak detected',
    detail: 'Other home devices stay grouped but still report health and automation readiness.',
  },
];

export function getHomeEnergyBalance(snapshot: HomeEnergySnapshot = homeEnergySnapshot): HomeEnergyBalance {
  const netKw = Number((snapshot.generationKw - snapshot.consumptionKw).toFixed(1));
  const selfSupplyPercent = snapshot.consumptionKw <= 0
    ? 100
    : Math.min(100, Math.round((snapshot.generationKw / snapshot.consumptionKw) * 100));

  return {
    netKw,
    selfSupplyPercent,
    mode: Math.abs(netKw) < 0.1 ? 'balanced' : netKw > 0 ? 'exporting' : 'importing',
  };
}

export function getHomeEnergySeriesTotals(
  samples: HomeEnergyDailySample[] = homeEnergyDailyProfile,
  series: HomeEnergySeries[] = homeEnergySeries,
): HomeEnergySeriesTotal[] {
  return series.map((item) => {
    const totalKwh = samples.reduce((total, sample, index) => {
      const nextSample = samples[index + 1];
      const hours = nextSample ? Math.max(0, nextSample.hour - sample.hour) : 0;
      return total + sample[item.id] * hours;
    }, 0);
    const peakKw = samples.reduce((peak, sample) => Math.max(peak, sample[item.id]), 0);

    return {
      ...item,
      totalKwh: Number(totalKwh.toFixed(1)),
      peakKw: Number(peakKw.toFixed(1)),
    };
  });
}

function getHomeEnergyTotalById(totals: HomeEnergySeriesTotal[], seriesId: HomeEnergySeriesId) {
  return totals.find((series) => series.id === seriesId)?.totalKwh ?? 0;
}

function getEstimatedGridExportKwh(samples: HomeEnergyDailySample[] = homeEnergyDailyProfile) {
  return Number(samples.reduce((total, sample, index) => {
    const nextSample = samples[index + 1];
    const hours = nextSample ? Math.max(0, nextSample.hour - sample.hour) : 0;
    const trackedLoadKw = sample.evChargeKw + sample.acKw + sample.powerSocketsKw + sample.appliancesKw + sample.poolKw;
    const availableKw = sample.solarPvKw + sample.gridImportKw + sample.batteryDischargeKw;
    const usedKw = trackedLoadKw + sample.batteryChargeKw;

    return total + Math.max(0, availableKw - usedKw) * hours;
  }, 0).toFixed(1));
}

export function getHomeEnergyDailySummary(samples: HomeEnergyDailySample[] = homeEnergyDailyProfile): HomeEnergyDailySummary {
  const totals = getHomeEnergySeriesTotals(samples);
  const loadTotals = totals.filter((series) => series.group === 'load');
  const fallbackLoad = loadTotals[0] ?? totals[0];
  if (!fallbackLoad) {
    throw new Error('Home energy summary requires at least one energy series.');
  }
  const consumptionKwh = Number(loadTotals.reduce((total, series) => total + series.totalKwh, 0).toFixed(1));
  const generationKwh = getHomeEnergyTotalById(totals, 'solarPvKw');
  const estimatedGridExportKwh = getEstimatedGridExportKwh(samples);
  const largestLoad = loadTotals.reduce(
    (largest, series) => (series.totalKwh > largest.totalKwh ? series : largest),
    fallbackLoad,
  );
  const batteryChargeKwh = getHomeEnergyTotalById(totals, 'batteryChargeKw');
  const batteryDischargeKwh = getHomeEnergyTotalById(totals, 'batteryDischargeKw');
  const localSupplyKwh = Math.max(0, generationKwh + batteryDischargeKwh - estimatedGridExportKwh);

  return {
    consumptionKwh,
    generationKwh,
    gridImportKwh: getHomeEnergyTotalById(totals, 'gridImportKw'),
    estimatedGridExportKwh,
    batteryChargeKwh,
    batteryDischargeKwh,
    batteryNetKwh: Number((batteryChargeKwh - batteryDischargeKwh).toFixed(1)),
    evKwh: getHomeEnergyTotalById(totals, 'evChargeKw'),
    acKwh: getHomeEnergyTotalById(totals, 'acKw'),
    socketsKwh: getHomeEnergyTotalById(totals, 'powerSocketsKw'),
    appliancesKwh: getHomeEnergyTotalById(totals, 'appliancesKw'),
    poolKwh: getHomeEnergyTotalById(totals, 'poolKw'),
    flexibleLoadKwh: Number((getHomeEnergyTotalById(totals, 'evChargeKw') + getHomeEnergyTotalById(totals, 'poolKw')).toFixed(1)),
    peakKw: getHomeEnergyDailyPeak(samples),
    selfSupplyEstimatePercent: consumptionKwh <= 0 ? 100 : Math.min(100, Math.round((localSupplyKwh / consumptionKwh) * 100)),
    largestLoad,
  };
}

export function getHomeEnergySeriesGroups(series: HomeEnergySeries[] = homeEnergySeries): HomeEnergySeriesGroup[] {
  const groups: HomeEnergySeriesGroup[] = [
    { group: 'supply', label: 'Supply', series: series.filter((item) => item.group === 'supply') },
    { group: 'storage', label: 'Storage', series: series.filter((item) => item.group === 'storage') },
    { group: 'load', label: 'Loads', series: series.filter((item) => item.group === 'load') },
  ];

  return groups.filter((group) => group.series.length > 0);
}

export function getVisibleHomeEnergySeriesTotals(visibleSeriesIds: HomeEnergySeriesId[]) {
  const visible = new Set(visibleSeriesIds);
  return getHomeEnergySeriesTotals().filter((series) => visible.has(series.id));
}

export function getHomeEnergyDailyPeak(samples: HomeEnergyDailySample[] = homeEnergyDailyProfile) {
  return Math.max(
    1,
    ...samples.flatMap((sample) => homeEnergySeries.map((series) => sample[series.id])),
  );
}

export function getHomeSystemHealthSummary(records: HomeSystemRecord[] = homeSystemRecords) {
  return {
    online: records.filter((record) => record.status === 'online').length,
    degraded: records.filter((record) => record.status === 'degraded').length,
    offline: records.filter((record) => record.status === 'offline').length,
    standby: records.filter((record) => record.status === 'standby').length,
    total: records.length,
  };
}

export function getHomeSystemGroups(records: HomeSystemRecord[] = homeSystemRecords): HomeSystemGroup[] {
  return homeSystemCategoryOrder
    .map((category) => ({
      category,
      label: homeSystemCategoryLabels[category],
      records: records.filter((record) => record.category === category),
    }))
    .filter((group) => group.records.length > 0);
}

export function getHomeTabletPropagationSummary(records: HomeSystemRecord[] = homeSystemRecords) {
  const tablets = records.filter((record) => record.category === 'tablet');

  return {
    online: tablets.filter((record) => record.status === 'online').length,
    degraded: tablets.filter((record) => record.status === 'degraded').length,
    total: tablets.length,
  };
}
