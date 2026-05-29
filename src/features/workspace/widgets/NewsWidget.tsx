import { useState } from 'react';

import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createRuntimeSnapshotEvidenceInput } from '../workspaceEvidenceModel';
import { getMarketGraph, marketCategories, type MarketGraph } from '../workspaceMarketData';
import { getMarketLiveQuote, type MarketLiveState } from '../workspaceMarketLiveData';
import { loadMarketWatchlist, saveMarketWatchlist, toggleMarketWatchlist } from '../workspaceMarketWatchlistModel';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

export function NewsWidget({
  activeGraph,
  marketLiveData,
  onSelectGraph,
  role,
  operationalOs,
}: {
  activeGraph: MarketGraph;
  marketLiveData: MarketLiveState;
  onSelectGraph: (graph: MarketGraph) => void;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
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
  const activeSource = activeQuote.status === 'live' ? 'live' : activeQuote.status === 'error' ? 'unavailable' : 'local';

  return (
    <WorkspaceContentShell className="news-surface">
      <WorkspaceStatusStrip
        source={activeSource}
        status={`${activeGraph.label} ${activeQuote.priceLabel}`}
        count={activeQuote.changeLabel}
        updatedAt={manualRefreshAt ? `manual ${manualRefreshAt}` : activeQuote.sourceLabel}
      />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={createRuntimeSnapshotEvidenceInput(
          `${activeGraph.label} market watch`,
          `market-${activeQuote.status}`,
          `${activeGraph.ticker} / ${activeQuote.priceLabel} / ${activeQuote.changeLabel} / ${activeQuote.sourceLabel}. ${activeQuote.detail}`,
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
