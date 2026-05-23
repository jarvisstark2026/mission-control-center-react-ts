import { useState } from 'react';

import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { getMarketGraph, marketCategories, type MarketGraph } from '../workspaceMarketData';
import { getMarketLiveQuote, type MarketLiveState } from '../workspaceMarketLiveData';
import { loadMarketWatchlist, saveMarketWatchlist, toggleMarketWatchlist } from '../workspaceMarketWatchlistModel';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

export function NewsWidget({
  activeGraph,
  marketLiveData,
  onSelectGraph,
}: {
  activeGraph: MarketGraph;
  marketLiveData: MarketLiveState;
  onSelectGraph: (graph: MarketGraph) => void;
}) {
  const [watchlistIds, setWatchlistIds] = usePersistentWorkspaceState(loadMarketWatchlist, saveMarketWatchlist);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [manualRefreshAt, setManualRefreshAt] = useState<string | null>(null);
  const activeQuote = getMarketLiveQuote(marketLiveData, activeGraph);
  const allNewsItems = marketCategories.flatMap((category) =>
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
  const newsItems = watchlistOnly ? allNewsItems.filter((item) => watchlistIds.includes(item.id)) : allNewsItems;

  return (
    <WorkspaceContentShell className="news-surface">
      <WorkspaceContentHeader
        eyebrow="News feed"
        title="market pulse / watchlist"
        metaEyebrow={marketLiveData.sourceLabel}
        meta={`${activeGraph.ticker} - ${watchlistIds.length} watched`}
      />
      <WorkspaceSummaryPanel className="news-summary" title={activeGraph.label}>
        {activeGraph.note}. Active quote: {activeQuote.priceLabel} / {activeQuote.changeLabel}. Source: {activeQuote.sourceLabel}.
        {manualRefreshAt ? ` Manual refresh requested at ${manualRefreshAt}.` : ''}
      </WorkspaceSummaryPanel>
      {marketLiveData.errors.length ? (
        <WorkspaceSummaryPanel className="market-live-alert" title="Market data fallback">
          {marketLiveData.errors[0]}
        </WorkspaceSummaryPanel>
      ) : null}
      <WorkspaceSectionFrame className="news-watchlist-section" eyebrow="watchlist" title="local market controls" meta="browser saved">
        <div className="news-watchlist-controls">
          <WorkspaceButton variant="secondary" onClick={() => setWatchlistOnly((current) => !current)}>
            {watchlistOnly ? 'Show all' : 'Watchlist only'}
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" onClick={() => setWatchlistIds((current) => toggleMarketWatchlist(current, activeGraph.id))}>
            {watchlistIds.includes(activeGraph.id) ? 'Remove active' : 'Watch active'}
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" onClick={() => setManualRefreshAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}>
            Refresh manual
          </WorkspaceButton>
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="news-feed-section" eyebrow="feed" title={watchlistOnly ? 'watchlist signals' : 'signal headlines'} meta={`${newsItems.length} items`}>
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
