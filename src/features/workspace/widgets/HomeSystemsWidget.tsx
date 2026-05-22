import { useMemo, useState, type CSSProperties } from 'react';

import type { ShellRole } from '../../shell/roles';
import type { MissionControlRuntime } from '../../mission-control';
import { AttentionCard, EvidenceBlock, PermissionBadge, RiskBadge, StatusSummary } from '../operationalBlocks';
import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame } from '../workspaceBlocks';
import {
  defaultVisibleHomeEnergySeriesIds,
  getHomeEnergyBalance,
  getHomeEnergyDailyPeak,
  getHomeEnergySeriesTotals,
  getHomeSystemGroups,
  getHomeSystemHealthSummary,
  getHomeTabletPropagationSummary,
  homeEnergyDailyProfile,
  homeEnergySeries,
  homeEnergySnapshot,
  type HomeEnergySeries,
  type HomeEnergySeriesId,
  type HomeSystemStatus,
} from '../homeSystemsModel';

function formatKw(value: number) {
  return `${value.toFixed(1)} kW`;
}

function getStatusRisk(status: HomeSystemStatus) {
  if (status === 'offline') return 'offline';
  if (status === 'degraded') return 'degraded';
  return 'online';
}

function getControlMode(role: ShellRole) {
  if (role === 'admin') return 'full control staging';
  if (role === 'home') return 'household control staging';
  if (role === 'support') return 'diagnostics only';
  return 'read only';
}

function formatKwh(value: number) {
  return `${value.toFixed(1)} kWh`;
}

function buildEnergySeriesPoints(series: HomeEnergySeries, maxKw: number) {
  return homeEnergyDailyProfile
    .map((sample) => {
      const x = (sample.hour / 24) * 100;
      const y = 100 - (sample[series.id] / maxKw) * 100;
      return `${x.toFixed(2)},${Math.max(0, Math.min(100, y)).toFixed(2)}`;
    })
    .join(' ');
}

export function HomeSystemsWidget({
  role,
  missionControl,
}: {
  role: ShellRole;
  missionControl: MissionControlRuntime;
}) {
  const [visibleSeriesIds, setVisibleSeriesIds] = useState<HomeEnergySeriesId[]>(defaultVisibleHomeEnergySeriesIds);
  const balance = getHomeEnergyBalance();
  const summary = getHomeSystemHealthSummary();
  const tabletSummary = getHomeTabletPropagationSummary();
  const groups = getHomeSystemGroups();
  const netDirection = balance.mode === 'exporting' ? 'export surplus' : balance.mode === 'importing' ? 'import required' : 'balanced';
  const visibleSeries = useMemo(
    () => homeEnergySeries.filter((series) => visibleSeriesIds.includes(series.id)),
    [visibleSeriesIds],
  );
  const seriesTotals = useMemo(() => getHomeEnergySeriesTotals(), []);
  const visibleSeriesTotals = useMemo(
    () => seriesTotals.filter((series) => visibleSeriesIds.includes(series.id)),
    [seriesTotals, visibleSeriesIds],
  );
  const maxKw = useMemo(() => getHomeEnergyDailyPeak(), []);
  const mainTotals = {
    grid: seriesTotals.find((series) => series.id === 'gridImportKw')?.totalKwh ?? 0,
    solar: seriesTotals.find((series) => series.id === 'solarPvKw')?.totalKwh ?? 0,
    battery: seriesTotals.find((series) => series.id === 'batteryChargeKw')?.totalKwh ?? 0,
    ev: seriesTotals.find((series) => series.id === 'evChargeKw')?.totalKwh ?? 0,
    ac: seriesTotals.find((series) => series.id === 'acKw')?.totalKwh ?? 0,
    sockets: seriesTotals.find((series) => series.id === 'powerSocketsKw')?.totalKwh ?? 0,
  };
  const toggleSeries = (seriesId: HomeEnergySeriesId) => {
    setVisibleSeriesIds((current) => {
      if (current.includes(seriesId)) {
        return current.length <= 1 ? current : current.filter((id) => id !== seriesId);
      }

      return [...current, seriesId];
    });
  };

  return (
    <WorkspaceContentShell className="mission-control-surface home-systems-surface">
      <WorkspaceContentHeader
        eyebrow="Home systems"
        title="energy, safety, automation, and rooms"
        metaEyebrow="access"
        meta={role}
      />

      <StatusSummary
        label="Whole-home state"
        title={`${formatKw(homeEnergySnapshot.generationKw)} generating / ${formatKw(homeEnergySnapshot.consumptionKw)} consuming`}
        detail="This widget is the home control surface: energy, Solar PV, EV charging, AC, appliances, automation, safety, cameras, pool, tablets, and other devices. Control actions should be staged through Command Inbox when the backend is connected."
        meta={missionControl.state.connection}
      />

      <WorkspaceMetricGrid
        className="mission-control-metrics home-energy-metrics"
        metrics={[
          { label: 'Today grid', value: formatKwh(mainTotals.grid) },
          { label: 'Today solar', value: formatKwh(mainTotals.solar) },
          { label: 'To battery', value: formatKwh(mainTotals.battery) },
          { label: 'Car charging', value: formatKwh(mainTotals.ev) },
          { label: 'AC load', value: formatKwh(mainTotals.ac) },
          { label: 'Power slots', value: formatKwh(mainTotals.sockets) },
          { label: 'Net balance', value: `${balance.netKw >= 0 ? '+' : ''}${formatKw(balance.netKw)}` },
          { label: 'Self supply', value: `${balance.selfSupplyPercent}%` },
          { label: 'Battery', value: `${homeEnergySnapshot.batteryPercent}%` },
          { label: 'EV range', value: `${homeEnergySnapshot.evRangeKm} km` },
        ]}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame home-systems-flow-frame"
        eyebrow="energy"
        title="daily energy graph"
        meta={`${visibleSeries.length} active / ${homeEnergySeries.length} layers`}
      >
        <div className="home-energy-daily">
          <div className="home-energy-chart-toolbar" aria-label="Home energy graph layers">
            <WorkspaceButton variant="compact" className="home-energy-toggle-master" onClick={() => setVisibleSeriesIds(defaultVisibleHomeEnergySeriesIds)}>
              Essentials
            </WorkspaceButton>
            <WorkspaceButton variant="compact" className="home-energy-toggle-master" onClick={() => setVisibleSeriesIds(homeEnergySeries.map((series) => series.id))}>
              All layers
            </WorkspaceButton>
            {homeEnergySeries.map((series) => {
              const active = visibleSeriesIds.includes(series.id);

              return (
                <button
                  key={series.id}
                  type="button"
                  className="home-energy-series-toggle"
                  aria-pressed={active}
                  onClick={() => toggleSeries(series.id)}
                  style={{ '--series-color': series.color } as CSSProperties}
                >
                  <span />
                  {series.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="home-energy-chart-shell">
            <div className="home-energy-chart-axis home-energy-chart-axis-y" aria-hidden="true">
              <span>{formatKw(maxKw)}</span>
              <span>{formatKw(maxKw / 2)}</span>
              <span>0 kW</span>
            </div>
            <svg className="home-energy-chart" viewBox="0 0 100 100" role="img" aria-label="Daily home energy graph">
              <defs>
                <linearGradient id="homeEnergyGridFade" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
              </defs>
              {[25, 50, 75].map((position) => (
                <line key={`y-${position}`} className="home-energy-chart-grid-line" x1="0" x2="100" y1={position} y2={position} />
              ))}
              {[25, 50, 75].map((position) => (
                <line key={`x-${position}`} className="home-energy-chart-grid-line" x1={position} x2={position} y1="0" y2="100" />
              ))}
              {visibleSeries.map((series) => {
                const points = buildEnergySeriesPoints(series, maxKw);

                return (
                  <g className="home-energy-chart-series" key={series.id} style={{ '--series-color': series.color } as CSSProperties}>
                    <polyline className="home-energy-chart-line-shadow" points={points} />
                    <polyline className="home-energy-chart-line" points={points} />
                  </g>
                );
              })}
            </svg>
            <div className="home-energy-chart-axis home-energy-chart-axis-x" aria-hidden="true">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
            </div>
          </div>

          <div className="home-energy-total-strip" role="list" aria-label="Visible energy totals">
            {visibleSeriesTotals.map((series) => (
              <div className="home-energy-total-pill" role="listitem" key={series.id} style={{ '--series-color': series.color } as CSSProperties}>
                <span>{series.shortLabel}</span>
                <strong>{formatKwh(series.totalKwh)}</strong>
                <small>peak {formatKw(series.peakKw)}</small>
              </div>
            ))}
          </div>

          <div className="home-energy-flow-copy">
            <EvidenceBlock label="Live balance" title={netDirection}>
              Current generation is {formatKw(homeEnergySnapshot.generationKw)} against {formatKw(homeEnergySnapshot.consumptionKw)} home load.
            </EvidenceBlock>
            <EvidenceBlock label="Useful layers" title="solar / grid / battery / EV / AC / sockets">
              Toggle layers to isolate where energy went across the day without leaving the home control workflow.
            </EvidenceBlock>
          </div>
        </div>
      </WorkspaceSectionFrame>

      <AttentionCard
        label="Home network propagation"
        title={`${tabletSummary.online}/${tabletSummary.total} wall tablets online`}
        risk={tabletSummary.degraded > 0 ? 'degraded' : 'online'}
      >
        <p>
          Wall-mounted tablets can mirror this Home Systems surface across the local network. Role-safe controls and monitoring state stay
          consistent with the main workspace.
        </p>
      </AttentionCard>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="systems"
        title="home control and monitoring"
        meta={`${summary.online} online / ${summary.degraded} degraded / ${summary.standby} standby`}
      >
        <div className="home-system-category-list" role="list" aria-label="Home systems by category">
          {groups.map((group) => (
            <WorkspaceSectionFrame
              key={group.category}
              className="mission-control-list-frame home-system-category-frame"
              eyebrow="home group"
              title={group.label}
              meta={`${group.records.length} devices`}
            >
              <div className="home-system-card-grid">
                {group.records.map((record) => (
                  <article className="mission-control-card home-system-card" key={record.id} data-state={record.status}>
                    <div className="mission-control-card-head">
                      <div>
                        <span>{record.zone}</span>
                        <strong>{record.name}</strong>
                        <small>{record.metric}</small>
                      </div>
                      <div className="home-system-badge-stack">
                        <RiskBadge risk={getStatusRisk(record.status)} />
                        <PermissionBadge level={record.capability} />
                      </div>
                    </div>
                    <p>{record.detail}</p>
                  </article>
                ))}
              </div>
            </WorkspaceSectionFrame>
          ))}
        </div>
      </WorkspaceSectionFrame>

      <StatusSummary
        label="Control mode"
        title={getControlMode(role)}
        detail="The first version is a typed local/mock dashboard. Backend adapters can later provide live meter, inverter, EV, alarm, camera, pool, tablet, and appliance state."
        meta={`${summary.total} tracked`}
      />
    </WorkspaceContentShell>
  );
}
