import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function GraphWidget() {
  return (
    <WorkspaceContentShell className="graph-surface">
      <WorkspaceContentHeader
        eyebrow="Telemetry graph"
        title="signal trace / trend line"
        metaEyebrow="scope"
        meta="3 channels"
      />
      <WorkspaceSummaryPanel className="graph-summary" title="signal monitor">
        Live trace staging now follows the shared Markets hierarchy, keeping chart context above the flexible graph body rather than embedded in bespoke chrome.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="graph-stage" eyebrow="chart" title="live trace" meta="sparkline">
        <div className="spark-panel">
          <div className="spark-line spark-a" />
          <div className="spark-line spark-b" />
          <div className="spark-line spark-c" />
          <div className="spark-grid" />
          <div className="spark-axis" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

