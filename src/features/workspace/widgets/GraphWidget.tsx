import type { MissionControlRuntime } from '../../mission-control';
import { WorkspaceCompactList, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

export function GraphWidget({ missionControl }: { missionControl?: MissionControlRuntime }) {
  const telemetry = missionControl?.state.telemetry ?? [];
  const latest = telemetry[0] ?? null;
  const channelMetrics = telemetry.slice(0, 4).map((sample) => ({
    label: sample.label,
    value: `${sample.value}${sample.unit}`,
  }));
  const rows = telemetry.slice(0, 6).map((sample) => ({
    id: sample.id,
    meta: sample.channel,
    title: `${sample.label} ${sample.value}${sample.unit}`,
    detail: `${sample.trend} / ${sample.severity}`,
    state: sample.severity === 'critical' ? 'failed' : sample.severity === 'warning' ? 'warning' : 'ready',
  }));

  return (
    <WorkspaceContentShell className="graph-surface">
      <WorkspaceContentHeader
        eyebrow="Telemetry graph"
        title={latest ? latest.label : 'local signal trace'}
        metaEyebrow={missionControl?.state.connection ?? 'local'}
        meta={`${telemetry.length} samples`}
      />
      <WorkspaceStatusStrip
        source={missionControl?.state.connection === 'connected' ? 'live' : 'local'}
        status={latest ? `${latest.value}${latest.unit} ${latest.trend}` : 'waiting for telemetry'}
        count={`${channelMetrics.length} channels`}
      />
      <WorkspaceSectionFrame className="graph-stage" eyebrow="chart" title="latest samples" meta={latest?.timestamp ? new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'no feed'}>
        <div className="spark-panel" aria-hidden="true">
          <div className="spark-line spark-a" />
          <div className="spark-line spark-b" />
          <div className="spark-line spark-c" />
          <div className="spark-grid" />
          <div className="spark-axis" />
        </div>
        {channelMetrics.length ? <WorkspaceMetricGrid metrics={channelMetrics} /> : null}
        <WorkspaceCompactList items={rows} empty="Telemetry rows appear when Mission Control receives live or local samples." ariaLabel="Telemetry rows" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
