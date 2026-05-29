import type { MissionControlRuntime } from '../../mission-control';
import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { WorkspaceCompactList, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';
import { getLatestTelemetryByChannel, getLatestTelemetrySample, getStableTelemetrySamples } from './stableWidgetSlots';

export function GraphWidget({
  missionControl,
  role,
  operationalOs,
}: {
  missionControl?: MissionControlRuntime;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
  const telemetry = missionControl?.state.telemetry ?? [];
  const latest = getLatestTelemetrySample(telemetry);
  const channelMetrics = getLatestTelemetryByChannel(telemetry).slice(0, 4).map((sample) => ({
    label: sample.label,
    value: `${sample.value}${sample.unit}`,
  }));
  const rows = getStableTelemetrySamples(telemetry).slice(0, 6).map((sample) => ({
    id: sample.id,
    meta: sample.channel,
    title: `${sample.label} ${sample.value}${sample.unit}`,
    detail: `${sample.trend} / ${sample.severity}`,
    state: sample.severity === 'critical' ? 'failed' : sample.severity === 'warning' ? 'warning' : 'ready',
  }));

  return (
    <WorkspaceContentShell className="graph-surface">
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
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={createRuntimeSnapshotEvidenceInput(
          'Telemetry snapshot',
          missionControl?.state.connection === 'connected' ? 'telemetry-live' : 'telemetry-local',
          latest
            ? `${latest.label} ${latest.value}${latest.unit} / ${latest.trend} / ${latest.severity}. ${telemetry.length} buffered samples.`
            : 'No telemetry samples available.',
        )}
        disabled={!telemetry.length}
        disabledReason={!telemetry.length ? 'Telemetry evidence appears after local or live samples are available.' : undefined}
      />
    </WorkspaceContentShell>
  );
}
