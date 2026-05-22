import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { type MarketGraph } from '../workspaceMarketData';

export function TradingGraphWidget({ graph }: { graph: MarketGraph }) {
  const summary = [
    { label: 'horizon', value: graph.horizon },
    { label: 'signal', value: graph.change },
    { label: 'notes', value: graph.note, wide: true },
  ];

  return (
    <WorkspaceContentShell className="trading-graph-surface">
      <WorkspaceContentHeader
        className="trading-graph-header"
        eyebrow="market graph"
        title={graph.label}
        metaEyebrow={graph.ticker}
        meta={graph.category}
      />
      <WorkspaceSummaryPanel className="trading-graph-routing" title="graph routing">
        Selecting a market item in the markets widget brings this graph forward and swaps the market context. No ceremony, just the useful bit.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="trading-graph-body" eyebrow="chart" title="active market trace" meta={graph.ticker}>
        <WorkspaceMetricGrid className="trading-graph-summary" metrics={summary} />
        <div className="trading-graph-stage">
          <div className="trading-graph-grid" />
          <div className="trading-graph-line trading-a" />
          <div className="trading-graph-line trading-b" />
          <div className="trading-graph-volume" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

