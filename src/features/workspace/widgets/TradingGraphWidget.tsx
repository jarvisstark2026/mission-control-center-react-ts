import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';
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

export function TradingGraphWidget({
  graph,
  marketLiveData,
  role,
  operationalOs,
}: {
  graph: MarketGraph;
  marketLiveData: MarketLiveState;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
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
  const quoteSource = quote.status === 'live' ? 'live' : quote.status === 'error' ? 'unavailable' : 'local';

  return (
    <WorkspaceContentShell className="trading-graph-surface">
      <WorkspaceContentHeader
        className="trading-graph-header"
        eyebrow="market graph"
        title={graph.label}
        metaEyebrow={graph.ticker}
        meta={quote.status}
      />
      <WorkspaceStatusStrip
        source={quoteSource}
        status={`${quote.priceLabel} / ${quote.changeLabel}`}
        count={quote.sourceLabel}
        updatedAt={formatUpdatedAt(quote.updatedAt)}
      />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={createRuntimeSnapshotEvidenceInput(
          `${graph.label} quote snapshot`,
          `market-${quote.status}`,
          `${graph.ticker} / ${quote.priceLabel} / ${quote.changeLabel} / ${quote.sourceLabel}. ${quote.detail}`,
        )}
      />
      {marketLiveData.errors.length ? (
        <WorkspaceStatusStrip
          className="market-live-alert"
          source="unavailable"
          status="feed issue"
          count={marketLiveData.errors[0]}
        />
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
