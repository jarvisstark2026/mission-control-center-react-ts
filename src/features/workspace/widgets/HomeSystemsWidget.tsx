import { useMemo, useState, type CSSProperties } from 'react';

import type { ShellRole } from '../../shell/roles';
import type { MissionControlRuntime } from '../../mission-control';
import type { OperationalOsRuntime } from '../../operational-os';
import { AttentionCard, EvidenceBlock, PermissionBadge, RiskBadge } from '../operationalBlocks';
import { WorkspaceButton, WorkspaceCompactList, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { createHomeSystemActionEvents, getHomeSystemActionPlansForRole, type HomeSystemActionId } from '../homeSystemsActions';
import { useHomeSystemsData } from '../homeSystemsAdapter';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';
import {
  defaultVisibleHomeEnergySeriesIds,
  getHomeEnergyBalance,
  getHomeEnergyDailySummary,
  getHomeEnergyDailyPeak,
  getHomeEnergySeriesGroups,
  getHomeEnergySeriesTotals,
  getHomeSystemGroups,
  getHomeSystemHealthSummary,
  getHomeTabletPropagationSummary,
  homeEnergySeries,
  type HomeEnergyDailySample,
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

function buildEnergySeriesPoints(series: HomeEnergySeries, dailyProfile: HomeEnergyDailySample[], maxKw: number) {
  return dailyProfile
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
  operationalOs,
}: {
  role: ShellRole;
  missionControl: MissionControlRuntime;
  operationalOs: OperationalOsRuntime;
}) {
  const [visibleSeriesIds, setVisibleSeriesIds] = useState<HomeEnergySeriesId[]>(defaultVisibleHomeEnergySeriesIds);
  const [stagedActionId, setStagedActionId] = useState<HomeSystemActionId | null>(null);
  const homeSystems = useHomeSystemsData();
  const { dailyProfile, records, snapshot, sourceStatus } = homeSystems;
  const balance = getHomeEnergyBalance(snapshot);
  const summary = getHomeSystemHealthSummary(records);
  const tabletSummary = getHomeTabletPropagationSummary(records);
  const groups = getHomeSystemGroups(records);
  const actionPlans = getHomeSystemActionPlansForRole(role);
  const netDirection = balance.mode === 'exporting' ? 'export surplus' : balance.mode === 'importing' ? 'import required' : 'balanced';
  const visibleSeries = useMemo(
    () => homeEnergySeries.filter((series) => visibleSeriesIds.includes(series.id)),
    [visibleSeriesIds],
  );
  const seriesTotals = useMemo(() => getHomeEnergySeriesTotals(dailyProfile), [dailyProfile]);
  const visibleSeriesTotals = useMemo(
    () => seriesTotals.filter((series) => visibleSeriesIds.includes(series.id)),
    [seriesTotals, visibleSeriesIds],
  );
  const dailySummary = useMemo(() => getHomeEnergyDailySummary(dailyProfile), [dailyProfile]);
  const seriesGroups = useMemo(() => getHomeEnergySeriesGroups(), []);
  const maxKw = useMemo(() => getHomeEnergyDailyPeak(dailyProfile), [dailyProfile]);
  const mainTotals = {
    grid: dailySummary.gridImportKwh,
    solar: dailySummary.generationKwh,
    battery: dailySummary.batteryChargeKwh,
    ev: dailySummary.evKwh,
    ac: dailySummary.acKwh,
    sockets: dailySummary.socketsKwh,
  };
  const toggleSeries = (seriesId: HomeEnergySeriesId) => {
    setVisibleSeriesIds((current) => {
      if (current.includes(seriesId)) {
        return current.length <= 1 ? current : current.filter((id) => id !== seriesId);
      }

      return [...current, seriesId];
    });
  };
  const stageHomeAction = (actionId: HomeSystemActionId) => {
    const events = createHomeSystemActionEvents(actionId, role);
    if (!events.length) return;

    missionControl.ingestEvents(events);
    setStagedActionId(actionId);
  };
  const hasBackendData = sourceStatus === 'backend-ready';
  const sourceLabel = sourceStatus === 'local-baseline' ? 'local baseline' : sourceStatus;

  if (!hasBackendData) {
    const setupRows = [
      {
        id: 'backend',
        meta: sourceLabel,
        title: homeSystems.error ?? 'Home systems backend is not connected',
        detail: 'VITE_HOME_SYSTEMS_API_URL',
        state: sourceStatus === 'offline' ? 'failed' : 'pending',
      },
      {
        id: 'safety',
        meta: 'gate',
        title: 'Home actions remain Command Inbox proposals',
        detail: getControlMode(role),
        state: actionPlans.length ? 'ready' : 'offline',
      },
      {
        id: 'scope',
        meta: 'local',
        title: 'Live energy/device values appear only after a backend responds',
        detail: 'source required',
        state: 'ready',
      },
    ];

    return (
      <WorkspaceContentShell className="mission-control-surface home-systems-surface">
        <WorkspaceStatusStrip
          source={sourceStatus === 'offline' ? 'unavailable' : 'local'}
          status={homeSystems.error ?? 'home backend not connected'}
          count={`${actionPlans.length} gated actions`}
          updatedAt="local baseline"
        />
        <WorkspaceEvidenceAttachPanel
          role={role}
          operationalOs={operationalOs}
          evidence={createRuntimeSnapshotEvidenceInput(
            'Home systems setup snapshot',
            sourceStatus === 'offline' ? 'home-systems-unavailable' : 'home-systems-local-baseline',
            `${sourceLabel} / ${homeSystems.error ?? 'backend not connected'} / ${actionPlans.length} gated actions available`,
          )}
        />
        <WorkspaceSectionFrame
          className="mission-control-list-frame home-action-frame"
          eyebrow="setup"
          title="connection and safety"
          meta="backend required"
        >
          <WorkspaceCompactList items={setupRows} empty="Configure the Home Systems backend to show live device data." ariaLabel="Home systems setup rows" />
        </WorkspaceSectionFrame>
        <WorkspaceSectionFrame
          className="mission-control-list-frame home-action-frame"
          eyebrow="actions"
          title="stage home proposals"
          meta={actionPlans.length ? 'Command Inbox gated' : 'read only'}
        >
          {actionPlans.length ? (
            <div className="home-action-grid" role="list" aria-label="Home action proposals">
              {actionPlans.slice(0, 4).map((plan) => (
                <AttentionCard
                  key={plan.id}
                  className="home-action-card"
                  label={`${plan.sourceArea} / ${plan.scope}`}
                  title={plan.title}
                  risk={plan.risk}
                  actions={
                    <WorkspaceButton
                      variant={plan.risk === 'critical' ? 'destructive' : 'secondary'}
                      className="mission-control-action"
                      onClick={() => stageHomeAction(plan.id)}
                    >
                      Stage proposal
                    </WorkspaceButton>
                  }
                >
                  <p>{plan.summary}</p>
                  <small>{stagedActionId === plan.id ? 'Sent to Command Inbox.' : plan.expectedResult}</small>
                </AttentionCard>
              ))}
            </div>
          ) : (
            <p className="mission-control-empty">This access scope can monitor Home Systems but cannot stage home actions.</p>
          )}
        </WorkspaceSectionFrame>
      </WorkspaceContentShell>
    );
  }

  return (
    <WorkspaceContentShell className="mission-control-surface home-systems-surface">
      <WorkspaceStatusStrip
        source={sourceStatus === 'backend-ready' ? 'live' : sourceStatus === 'offline' ? 'unavailable' : 'local'}
        status={`${formatKw(snapshot.generationKw)} generating / ${formatKw(snapshot.consumptionKw)} consuming`}
        count={sourceLabel}
        updatedAt={homeSystems.error ?? `${summary.total} tracked`}
      />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={createRuntimeSnapshotEvidenceInput(
          'Home systems runtime snapshot',
          sourceStatus === 'backend-ready' ? 'home-systems-live' : 'home-systems-local-baseline',
          `${sourceLabel} / generation ${formatKw(snapshot.generationKw)} / consumption ${formatKw(snapshot.consumptionKw)} / ${summary.total} tracked systems`,
        )}
      />

      <WorkspaceMetricGrid
        className="mission-control-metrics home-energy-metrics"
        metrics={[
          { label: 'Daily load', value: formatKwh(dailySummary.consumptionKwh) },
          { label: 'Daily generation', value: formatKwh(dailySummary.generationKwh) },
          { label: 'Today grid', value: formatKwh(mainTotals.grid) },
          { label: 'Grid export', value: formatKwh(dailySummary.estimatedGridExportKwh) },
          { label: 'To battery', value: formatKwh(mainTotals.battery) },
          { label: 'Battery net', value: `${dailySummary.batteryNetKwh >= 0 ? '+' : ''}${formatKwh(dailySummary.batteryNetKwh)}` },
          { label: 'Car charging', value: formatKwh(mainTotals.ev) },
          { label: 'AC load', value: formatKwh(mainTotals.ac) },
          { label: 'Power slots', value: formatKwh(mainTotals.sockets) },
          { label: 'Appliances', value: formatKwh(dailySummary.appliancesKwh) },
          { label: 'Pool', value: formatKwh(dailySummary.poolKwh) },
          { label: 'Net balance', value: `${balance.netKw >= 0 ? '+' : ''}${formatKw(balance.netKw)}` },
          { label: 'Self supply', value: `${balance.selfSupplyPercent}%` },
          { label: 'Daily self supply', value: `${dailySummary.selfSupplyEstimatePercent}%` },
          { label: 'Largest load', value: dailySummary.largestLoad.shortLabel },
          { label: 'Battery', value: `${snapshot.batteryPercent}%` },
          { label: 'EV range', value: `${snapshot.evRangeKm} km` },
        ]}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame home-systems-flow-frame"
        eyebrow="monitoring"
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
            {seriesGroups.map((group) => (
              <div className="home-energy-series-group" key={group.group}>
                <small>{group.label}</small>
                {group.series.map((series) => {
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
            ))}
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
                  <stop offset="0%" stopColor="var(--home-energy-grid-start)" />
                  <stop offset="100%" stopColor="var(--home-energy-grid-end)" />
                </linearGradient>
              </defs>
              {[25, 50, 75].map((position) => (
                <line key={`y-${position}`} className="home-energy-chart-grid-line" x1="0" x2="100" y1={position} y2={position} />
              ))}
              {[25, 50, 75].map((position) => (
                <line key={`x-${position}`} className="home-energy-chart-grid-line" x1={position} x2={position} y1="0" y2="100" />
              ))}
              {visibleSeries.map((series) => {
                const points = buildEnergySeriesPoints(series, dailyProfile, maxKw);

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
            <EvidenceBlock label="Current state" title={netDirection}>
              Current generation is {formatKw(snapshot.generationKw)} against {formatKw(snapshot.consumptionKw)} home load.
            </EvidenceBlock>
            <EvidenceBlock label="Daily priority" title={`${dailySummary.largestLoad.shortLabel} is the largest tracked load`}>
              Flexible loads account for {formatKwh(dailySummary.flexibleLoadKwh)} today. Stage proposals below to move them into solar surplus.
            </EvidenceBlock>
            <EvidenceBlock label="Evidence for decisions" title="source / trend / impact">
              These readings are monitoring evidence only. Control proposals still require Command Inbox approval.
            </EvidenceBlock>
          </div>
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame home-action-frame"
        eyebrow="actions"
        title="stage home proposals"
        meta={actionPlans.length ? 'Command Inbox gated' : 'read only'}
      >
        {actionPlans.length ? (
          <div className="home-action-grid" role="list" aria-label="Home action proposals">
            {actionPlans.map((plan) => (
              <AttentionCard
                key={plan.id}
                className="home-action-card"
                label={`${plan.sourceArea} / ${plan.scope}`}
                title={plan.title}
                risk={plan.risk}
                actions={
                  <WorkspaceButton
                    variant={plan.risk === 'critical' ? 'destructive' : 'secondary'}
                    className="mission-control-action"
                    onClick={() => stageHomeAction(plan.id)}
                  >
                    Stage proposal
                  </WorkspaceButton>
                }
              >
                <p>{plan.summary}</p>
                <small>{stagedActionId === plan.id ? 'Sent to Command Inbox.' : plan.expectedResult}</small>
              </AttentionCard>
            ))}
          </div>
        ) : (
          <p className="mission-control-empty">This access scope can monitor Home Systems but cannot stage home actions.</p>
        )}
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

      <WorkspaceStatusStrip
        source="bridge"
        status={getControlMode(role)}
        count={`${summary.total} tracked`}
        updatedAt="Command Inbox gates controls"
      />
    </WorkspaceContentShell>
  );
}
