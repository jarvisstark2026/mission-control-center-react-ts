import { describe, expect, it } from 'vitest';

import {
  defaultVisibleHomeEnergySeriesIds,
  getHomeEnergyDailyPeak,
  getHomeEnergyDailySummary,
  getHomeEnergyBalance,
  getHomeEnergySeriesGroups,
  getHomeEnergySeriesTotals,
  getVisibleHomeEnergySeriesTotals,
  getHomeSystemGroups,
  getHomeSystemHealthSummary,
  getHomeTabletPropagationSummary,
  homeEnergySeries,
  homeSystemRecords,
} from './homeSystemsModel';

describe('homeSystemsModel', () => {
  it('calculates home energy balance from consumption and generation', () => {
    expect(getHomeEnergyBalance({ consumptionKw: 3, generationKw: 4.5, solarPvKw: 4.5, batteryPercent: 80, evChargeKw: 0, evRangeKm: 220, timestamp: 'now' })).toEqual({
      netKw: 1.5,
      selfSupplyPercent: 100,
      mode: 'exporting',
    });

    expect(getHomeEnergyBalance({ consumptionKw: 5, generationKw: 2.2, solarPvKw: 2.2, batteryPercent: 80, evChargeKw: 0, evRangeKm: 220, timestamp: 'now' })).toMatchObject({
      netKw: -2.8,
      mode: 'importing',
    });
  });

  it('groups home devices in the expected control categories', () => {
    const groups = getHomeSystemGroups();

    expect(groups.map((group) => group.label)).toContain('Solar PV');
    expect(groups.map((group) => group.label)).toContain('CCTV and doorbell');
    expect(groups.map((group) => group.label)).toContain('Other home devices');
    expect(groups.flatMap((group) => group.records)).toHaveLength(homeSystemRecords.length);
  });

  it('summarizes health and wall tablet propagation', () => {
    expect(getHomeSystemHealthSummary()).toMatchObject({
      degraded: 2,
      online: 11,
      standby: 2,
      total: homeSystemRecords.length,
    });

    expect(getHomeTabletPropagationSummary()).toEqual({
      degraded: 0,
      online: 2,
      total: 2,
    });
  });

  it('summarizes daily energy graph series and defaults', () => {
    const totals = getHomeEnergySeriesTotals();

    expect(totals).toHaveLength(homeEnergySeries.length);
    expect(defaultVisibleHomeEnergySeriesIds).toEqual([
      'gridImportKw',
      'solarPvKw',
      'batteryChargeKw',
      'evChargeKw',
      'acKw',
      'powerSocketsKw',
    ]);
    expect(totals.find((series) => series.id === 'solarPvKw')).toMatchObject({
      label: 'Solar PV generation',
      peakKw: 6.2,
      totalKwh: 48.4,
    });
    expect(totals.find((series) => series.id === 'evChargeKw')?.totalKwh).toBeGreaterThan(15);
    expect(getHomeEnergyDailyPeak()).toBe(6.2);
  });

  it('summarizes the daily home energy flow for operator decisions', () => {
    const summary = getHomeEnergyDailySummary();

    expect(summary.generationKwh).toBe(48.4);
    expect(summary.consumptionKwh).toBeGreaterThan(70);
    expect(summary.gridImportKwh).toBeGreaterThan(25);
    expect(summary.estimatedGridExportKwh).toBeGreaterThanOrEqual(0);
    expect(summary.flexibleLoadKwh).toBeCloseTo(summary.evKwh + summary.poolKwh, 1);
    expect(summary.largestLoad.id).toBe('evChargeKw');
    expect(summary.selfSupplyEstimatePercent).toBeGreaterThan(0);
  });

  it('groups graph layers by supply, storage, and load', () => {
    const groups = getHomeEnergySeriesGroups();

    expect(groups.map((group) => group.group)).toEqual(['supply', 'storage', 'load']);
    expect(groups.find((group) => group.group === 'load')?.series.map((series) => series.id)).toContain('acKw');
    expect(groups.flatMap((group) => group.series)).toHaveLength(homeEnergySeries.length);
  });

  it('filters visible daily energy graph totals without changing source data', () => {
    const visible = getVisibleHomeEnergySeriesTotals(['solarPvKw', 'evChargeKw', 'acKw']);

    expect(visible.map((series) => series.id)).toEqual(['solarPvKw', 'evChargeKw', 'acKw']);
    expect(visible.every((series) => series.totalKwh > 0)).toBe(true);
  });
});
