import { WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { getMarketGraph, marketCategories, type MarketGraph } from '../workspaceMarketData';
import { getMarketLiveQuote, type MarketLiveState } from '../workspaceMarketLiveData';

export function NewsWidget({
  activeGraph,
  marketLiveData,
  onSelectGraph,
}: {
  activeGraph: MarketGraph;
  marketLiveData: MarketLiveState;
  onSelectGraph: (graph: MarketGraph) => void;
}) {
  const activeQuote = getMarketLiveQuote(marketLiveData, activeGraph);
  const newsItems = marketCategories.flatMap((category) =>
    category.graphs.map((graph) => {
      const quote = getMarketLiveQuote(marketLiveData, graph);
      const livePrefix = quote.status === 'live' ? `${quote.priceLabel} / ${quote.sourceLabel}` : quote.sourceLabel;

      return {
        id: graph.id,
        label: graph.label,
        note: `${graph.category} - ${livePrefix}. ${quote.detail}`,
        badge: quote.status === 'live' ? quote.changeLabel : graph.change,
        active: graph.id === activeGraph.id,
        state: quote.status,
      };
    }),
  );

  return (
    <WorkspaceContentShell className="news-surface">
      <WorkspaceContentHeader
        eyebrow="News feed"
        title="market pulse / watchlist"
        metaEyebrow={marketLiveData.sourceLabel}
        meta={activeGraph.ticker}
      />
      <WorkspaceSummaryPanel className="news-summary" title={activeGraph.label}>
        {activeGraph.note}. Active quote: {activeQuote.priceLabel} / {activeQuote.changeLabel}. Source: {activeQuote.sourceLabel}.
      </WorkspaceSummaryPanel>
      {marketLiveData.errors.length ? (
        <WorkspaceSummaryPanel className="market-live-alert" title="Market data fallback">
          {marketLiveData.errors[0]}
        </WorkspaceSummaryPanel>
      ) : null}
      <WorkspaceSectionFrame className="news-feed-section" eyebrow="feed" title="signal headlines" meta={`${newsItems.length} items`}>
        <WorkspaceCatalogGrid
          className="news-feed-grid"
          variant="market"
          ariaLabel="Market news signals"
          items={newsItems}
          onSelect={(item) => onSelectGraph(getMarketGraph(item.id))}
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
