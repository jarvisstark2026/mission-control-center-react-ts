import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { type MarketGraph } from '../workspaceMarketData';
import { getMarketLiveQuote, type MarketLiveState } from '../workspaceMarketLiveData';

function buildSparklinePoints(points: number[]) {
  if (!points.length) return '';

  return points
    .map((value, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
      const y = 100 - value;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function TradingGraphWidget({ graph, marketLiveData }: { graph: MarketGraph; marketLiveData: MarketLiveState }) {
  const quote = getMarketLiveQuote(marketLiveData, graph);
  const sparklinePoints = buildSparklinePoints(quote.sparkline);
  const summary = [
    { label: 'quote', value: quote.priceLabel },
    { label: 'signal', value: quote.changeLabel },
    { label: 'source', value: quote.sourceLabel },
    { label: 'horizon', value: graph.horizon },
    { label: 'updated', value: formatUpdatedAt(quote.updatedAt) },
    { label: 'notes', value: quote.detail, wide: true },
  ];

  return (
    <WorkspaceContentShell className="trading-graph-surface">
      <WorkspaceContentHeader
        className="trading-graph-header"
        eyebrow="market graph"
        title={graph.label}
        metaEyebrow={graph.ticker}
        meta={quote.status}
      />
      <WorkspaceSummaryPanel className="trading-graph-routing" title="graph routing">
        Markets drives this focused chart. Crypto and FX use public live feeds; unsupported instruments stay visible as static fallback instead of hiding risk.
      </WorkspaceSummaryPanel>
      {marketLiveData.errors.length ? (
        <WorkspaceSummaryPanel className="market-live-alert" title="Feed status">
          {marketLiveData.errors[0]}
        </WorkspaceSummaryPanel>
      ) : null}
      <WorkspaceSectionFrame className="trading-graph-body" eyebrow="chart" title="active market trace" meta={graph.ticker}>
        <WorkspaceMetricGrid className="trading-graph-summary" metrics={summary} />
        <div className="trading-graph-stage" data-status={quote.status}>
          <div className="trading-graph-grid" />
          <svg className="trading-graph-sparkline" viewBox="0 0 100 100" role="img" aria-label={`${graph.label} market trace`}>
            <polyline className="trading-graph-sparkline-shadow" points={sparklinePoints} />
            <polyline className="trading-graph-sparkline-line" points={sparklinePoints} />
          </svg>
          <div className="trading-graph-volume" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
