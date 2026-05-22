import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function OverviewWidget() {
  const stats = [
    { label: 'system', value: '98%' },
    { label: 'devices', value: '24' },
    { label: 'alerts', value: '12' },
    { label: 'workspace mode', value: 'drag / resize / stack / fade', wide: true },
  ];

  return (
    <WorkspaceContentShell className="overview-surface">
      <WorkspaceContentHeader
        eyebrow="System overview"
        title="status / devices / alerts"
        metaEyebrow="workspace"
        meta="live frame"
      />
      <WorkspaceSummaryPanel className="overview-summary" title="workspace health">
        Core workspace telemetry now uses the same header, status, and stage cadence as Markets before expanding into the live command summary.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="overview-dashboard" eyebrow="telemetry" title="command summary" meta={`${stats.length} signals`}>
        <div className="widget-grid">
          <div className="stats-arc" />
          <WorkspaceMetricGrid metrics={stats} />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

